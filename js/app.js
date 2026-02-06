/**
 * NEUTRA Main Application Module
 * Core functionality for music discovery platform
 */
const NEUTRA = (function() {
    'use strict';

    // ==========================================
    // Private State
    // ==========================================
    
    let catalog = null;
    let links = null;
    let isInitialized = false;
    
    const CACHE_KEY = 'neutra_cache';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // ==========================================
    // Data Loading
    // ==========================================

    /**
     * Load JSON data with caching
     * @param {string} url - URL to fetch
     * @returns {Promise<Object>}
     */
    async function loadJSON(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Failed to load ${url}:`, error);
            return null;
        }
    }

    /**
     * Initialize application data
     * @returns {Promise<boolean>}
     */
    async function init() {
        if (isInitialized) return true;

        // Check cache
        const cached = getCache();
        if (cached) {
            catalog = cached.catalog;
            links = cached.links;
        } else {
            // Load fresh data
            const [catalogData, linksData] = await Promise.all([
                loadJSON('data/catalog.json'),
                loadJSON('data/links.json')
            ]);
            
            catalog = catalogData;
            links = linksData;
            
            if (catalog && links) {
                setCache({ catalog, links });
            }
        }

        if (catalog) {
            Search.buildIndex(catalog);
        }

        isInitialized = true;
        initGlobalSearch();
        initMobileMenu();
        
        return catalog !== null;
    }

    /**
     * Get cached data
     * @returns {Object|null}
     */
    function getCache() {
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp > CACHE_DURATION) {
                sessionStorage.removeItem(CACHE_KEY);
                return null;
            }
            return data;
        } catch {
            return null;
        }
    }

    /**
     * Set cache data
     * @param {Object} data - Data to cache
     */
    function setCache(data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                ...data,
                timestamp: Date.now()
            }));
        } catch {
            // Storage full or disabled
        }
    }

    // ==========================================
    // Utility Functions
    // ==========================================

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string}
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format duration in seconds to mm:ss
     * @param {number} seconds - Duration in seconds
     * @returns {string}
     */
    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Calculate total duration of tracks
     * @param {Array} tracks - Array of track objects
     * @returns {string}
     */
    function calculateTotalDuration(tracks) {
        if (!tracks || !tracks.length) return '0 min';
        const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
        const mins = Math.floor(total / 60);
        if (mins < 60) return `${mins} min`;
        const hours = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hours} hr ${remainMins} min`;
    }

    // ==========================================
    // Global Search
    // ==========================================

    function initGlobalSearch() {
        const searchInput = document.getElementById('global-search');
        const dropdown = document.getElementById('search-dropdown');
        
        if (!searchInput || !dropdown) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                dropdown.classList.remove('active');
                dropdown.innerHTML = '';
                return;
            }

            Search.debouncedSearch(query, (results, q) => {
                renderSearchDropdown(results, q, dropdown);
            }, { limit: 8 });
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    Router.navigate(Router.buildUrl('search.html', { q: query }));
                }
            }
            if (e.key === 'Escape') {
                dropdown.classList.remove('active');
                searchInput.blur();
            }
        });

        searchInput.addEventListener('focus', () => {
            const query = searchInput.value.trim();
            if (query.length >= 2 && dropdown.innerHTML) {
                dropdown.classList.add('active');
            }
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                dropdown.classList.remove('active');
            }
        });
    }

    function renderSearchDropdown(results, query, container) {
        const hasResults = results.tracks.length > 0 || results.albums.length > 0;
        
        if (!hasResults) {
            container.innerHTML = `<div class="search-dropdown-empty">No results for "${escapeHtml(query)}"</div>`;
            container.classList.add('active');
            return;
        }

        let html = '';
        
        // Tracks
        results.tracks.slice(0, 5).forEach(track => {
            html += `
                <a href="track.html?id=${track.id}" class="search-dropdown-item">
                    <img src="${track.cover || getPlaceholderImage()}" alt="" onerror="this.src='${getPlaceholderImage()}'">
                    <div class="search-dropdown-item-info">
                        <div class="search-dropdown-item-title">${escapeHtml(track.title)}</div>
                        <div class="search-dropdown-item-subtitle">${escapeHtml(track.artist)}</div>
                    </div>
                    <span class="search-dropdown-item-type">Track</span>
                </a>
            `;
        });

        // Albums
        results.albums.slice(0, 3).forEach(album => {
            html += `
                <a href="album.html?id=${album.id}" class="search-dropdown-item">
                    <img src="${album.cover || getPlaceholderImage()}" alt="" onerror="this.src='${getPlaceholderImage()}'">
                    <div class="search-dropdown-item-info">
                        <div class="search-dropdown-item-title">${escapeHtml(album.title)}</div>
                        <div class="search-dropdown-item-subtitle">${escapeHtml(album.artist)}</div>
                    </div>
                    <span class="search-dropdown-item-type">Album</span>
                </a>
            `;
        });

        // View all link
        html += `
            <a href="search.html?q=${encodeURIComponent(query)}" class="search-dropdown-item" style="justify-content: center; color: var(--color-gray-400);">
                View all results for "${escapeHtml(query)}"
            </a>
        `;

        container.innerHTML = html;
        container.classList.add('active');
    }

    /**
     * Get placeholder image data URI
     * @returns {string}
     */
    function getPlaceholderImage() {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect fill='%23222' width='400' height='400'/%3E%3Cpath d='M200 120c-22 0-40 18-40 40v60c0 22 18 40 40 40s40-18 40-40v-60c0-22-18-40-40-40zm-80 100v-40c0-44 36-80 80-80s80 36 80 80v40' fill='none' stroke='%23444' stroke-width='8'/%3E%3C/svg%3E";
    }

    // ==========================================
    // Mobile Menu
    // ==========================================

    function initMobileMenu() {
        const toggle = document.getElementById('menu-toggle');
        const nav = document.getElementById('nav');
        const searchContainer = document.querySelector('.search-container');
        
        if (!toggle || !nav) return;

        toggle.addEventListener('click', () => {
            const isActive = nav.classList.toggle('active');
            toggle.classList.toggle('active');
            
            // Also toggle search on mobile
            if (searchContainer) {
                searchContainer.classList.toggle('active', isActive);
            }
        });

        // Close menu on nav link click
        nav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                toggle.classList.remove('active');
                if (searchContainer) {
                    searchContainer.classList.remove('active');
                }
            });
        });
    }

    // ==========================================
    // Platform Buttons
    // ==========================================

    /**
     * Render platform buttons for a track
     * @param {string} trackId - Track ID
     * @param {string} containerId - Container element ID
     */
    function renderPlatformButtons(trackId, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !links?.tracks) return;

        const trackLinks = links.tracks[trackId];
        if (!trackLinks) {
            container.innerHTML = '<p style="color: var(--color-gray-500); font-size: 0.875rem;">No streaming links available</p>';
            return;
        }

        const platforms = [
            { 
                key: 'spotify', 
                name: 'Spotify',
                icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`
            },
            { 
                key: 'apple', 
                name: 'Apple Music',
                icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`
            },
            { 
                key: 'youtube', 
                name: 'YouTube',
                icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
            },
            { 
                key: 'audiomack', 
                name: 'Audiomack',
                icon: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M8 15V9l8 3-8 3z" fill="black"/></svg>`
            }
        ];

        let html = '';
        platforms.forEach(platform => {
            if (trackLinks[platform.key]) {
                html += `
                    <a href="${escapeHtml(trackLinks[platform.key])}" target="_blank" rel="noopener noreferrer" class="platform-btn">
                        ${platform.icon}
                        <span>${platform.name}</span>
                    </a>
                `;
            }
        });

        if (!html) {
            html = '<p style="color: var(--color-gray-500); font-size: 0.875rem;">No streaming links available</p>';
        }

        container.innerHTML = html;
    }

    /**
     * Render platform buttons for an album
     * @param {string} albumId - Album ID
     * @param {string} containerId - Container element ID
     */
    function renderAlbumPlatformButtons(albumId, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !links?.albums) return;

        const albumLinks = links.albums[albumId];
        if (!albumLinks) {
            container.innerHTML = '';
            return;
        }

        const platforms = [
            { key: 'spotify', name: 'Spotify', icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>` },
            { key: 'apple', name: 'Apple Music', icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>` },
            { key: 'youtube', name: 'YouTube', icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` }
        ];

        let html = '';
        platforms.forEach(platform => {
            if (albumLinks[platform.key]) {
                html += `
                    <a href="${escapeHtml(albumLinks[platform.key])}" target="_blank" rel="noopener noreferrer" class="platform-btn">
                        ${platform.icon}
                        <span>${platform.name}</span>
                    </a>
                `;
            }
        });

        container.innerHTML = html;
    }

    // ==========================================
    // Rendering Functions
    // ==========================================

    /**
     * Render featured tracks
     */
    function renderFeaturedTracks(containerId, limit = 8) {
        const container = document.getElementById(containerId);
        if (!container || !catalog?.tracks) return;

        const featured = catalog.tracks
            .filter(t => t.featured)
            .slice(0, limit);
        
        const tracks = featured.length > 0 ? featured : catalog.tracks.slice(0, limit);
        container.innerHTML = tracks.map(track => createTrackCard(track)).join('');
    }

    /**
     * Render latest albums
     */
    function renderLatestAlbums(containerId, limit = 4) {
        const container = document.getElementById(containerId);
        if (!container || !catalog?.albums) return;

        const albums = [...catalog.albums]
            .sort((a, b) => (b.year || 0) - (a.year || 0))
            .slice(0, limit);
        
        container.innerHTML = albums.map(album => createAlbumCard(album)).join('');
    }

    /**
     * Render trending tracks
     */
    function renderTrendingTracks(containerId, limit = 10) {
        const container = document.getElementById(containerId);
        if (!container || !catalog?.tracks) return;

        const trending = catalog.tracks
            .filter(t => t.trending)
            .slice(0, limit);
        
        const tracks = trending.length > 0 ? trending : catalog.tracks.slice(0, limit);
        container.innerHTML = tracks.map(track => createTrackListItem(track)).join('');
    }

    /**
     * Create track card HTML
     */
    function createTrackCard(track) {
        return `
            <a href="track.html?id=${track.id}" class="track-card">
                <div class="track-card-image">
                    <img src="${track.cover || getPlaceholderImage()}" alt="${escapeHtml(track.title)}" loading="lazy" onerror="this.src='${getPlaceholderImage()}'">
                    <div class="track-card-overlay">
                        <span class="track-card-play">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </span>
                    </div>
                </div>
                <div class="track-card-content">
                    <div class="track-card-title">${escapeHtml(track.title)}</div>
                    <div class="track-card-artist">${escapeHtml(track.artist)}</div>
                    ${track.uzt ? '<span class="track-card-uzt">UZT</span>' : ''}
                </div>
            </a>
        `;
    }

    /**
     * Create album card HTML
     */
    function createAlbumCard(album) {
        return `
            <a href="album.html?id=${album.id}" class="album-card">
                <div class="album-card-image">
                    <img src="${album.cover || getPlaceholderImage()}" alt="${escapeHtml(album.title)}" loading="lazy" onerror="this.src='${getPlaceholderImage()}'">
                </div>
                <div class="album-card-content">
                    <div class="album-card-title">${escapeHtml(album.title)}</div>
                    <div class="album-card-artist">${escapeHtml(album.artist)}</div>
                    <div class="album-card-year">${album.year || ''}</div>
                </div>
            </a>
        `;
    }

    /**
     * Create track list item HTML
     */
    function createTrackListItem(track) {
        return `
            <a href="track.html?id=${track.id}" class="track-list-item">
                <div class="track-list-image">
                    <img src="${track.cover || getPlaceholderImage()}" alt="${escapeHtml(track.title)}" loading="lazy" onerror="this.src='${getPlaceholderImage()}'">
                </div>
                <div class="track-list-info">
                    <div class="track-list-title">${escapeHtml(track.title)}</div>
                    <div class="track-list-artist">${escapeHtml(track.artist)}</div>
                </div>
                ${track.uzt ? '<span class="track-list-uzt">UZT</span>' : ''}
                <div class="track-list-duration">${formatDuration(track.duration)}</div>
            </a>
        `;
    }

    /**
     * Create UZT card HTML
     */
    function createUZTCard(track) {
        return `
            <a href="track.html?id=${track.id}" class="uzt-card">
                <div class="uzt-card-image">
                    <img src="${track.cover || getPlaceholderImage()}" alt="${escapeHtml(track.title)}" loading="lazy" onerror="this.src='${getPlaceholderImage()}'">
                    <span class="uzt-card-badge">UZT</span>
                </div>
                <div class="uzt-card-content">
                    <div class="uzt-card-title">${escapeHtml(track.title)}</div>
                    <div class="uzt-card-artist">${escapeHtml(track.artist)}</div>
                    <div class="uzt-card-duration">${formatDuration(track.duration)}</div>
                </div>
            </a>
        `;
    }

    // ==========================================
    // Discover Page
    // ==========================================

    function initDiscoverPage() {
        if (!catalog) return;

        const tabs = document.querySelectorAll('.filter-tab');
        const contents = document.querySelectorAll('.discover-content');
        const sortSelect = document.getElementById('sort-select');

        let currentSort = 'newest';
        let tracksPage = 1;
        const tracksPerPage = 20;

        function getSortedTracks() {
            let tracks = [...catalog.tracks];
            switch (currentSort) {
                case 'oldest':
                    tracks.reverse();
                    break;
                case 'az':
                    tracks.sort((a, b) => a.title.localeCompare(b.title));
                    break;
                case 'za':
                    tracks.sort((a, b) => b.title.localeCompare(a.title));
                    break;
                case 'artist':
                    tracks.sort((a, b) => a.artist.localeCompare(b.artist));
                    break;
            }
            return tracks;
        }

        function getSortedAlbums() {
            let albums = [...catalog.albums];
            switch (currentSort) {
                case 'oldest':
                    albums.sort((a, b) => (a.year || 0) - (b.year || 0));
                    break;
                case 'newest':
                    albums.sort((a, b) => (b.year || 0) - (a.year || 0));
                    break;
                case 'az':
                    albums.sort((a, b) => a.title.localeCompare(b.title));
                    break;
                case 'za':
                    albums.sort((a, b) => b.title.localeCompare(a.title));
                    break;
                case 'artist':
                    albums.sort((a, b) => a.artist.localeCompare(b.artist));
                    break;
            }
            return albums;
        }

        function renderAllContent() {
            const tracks = getSortedTracks();
            const albums = getSortedAlbums();

            document.getElementById('all-tracks').innerHTML = 
                tracks.slice(0, tracksPage * tracksPerPage).map(t => createTrackCard(t)).join('');
            
            document.getElementById('all-albums').innerHTML = 
                albums.map(a => createAlbumCard(a)).join('');

            const loadMoreBtn = document.getElementById('load-more-tracks');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = tracksPage * tracksPerPage >= tracks.length ? 'none' : 'block';
            }
        }

        function renderTracksOnly() {
            const tracks = getSortedTracks();
            document.getElementById('tracks-only').innerHTML = 
                tracks.slice(0, tracksPage * tracksPerPage).map(t => createTrackCard(t)).join('');

            const loadMoreBtn = document.getElementById('load-more-tracks-only');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = tracksPage * tracksPerPage >= tracks.length ? 'none' : 'block';
            }
        }

        function renderAlbumsOnly() {
            const albums = getSortedAlbums();
            document.getElementById('albums-only').innerHTML = 
                albums.map(a => createAlbumCard(a)).join('');
        }

        // Tab switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const filter = tab.dataset.filter;
                contents.forEach(c => c.classList.remove('active'));
                document.getElementById(`content-${filter}`).classList.add('active');

                tracksPage = 1;
                if (filter === 'all') renderAllContent();
                else if (filter === 'tracks') renderTracksOnly();
                else if (filter === 'albums') renderAlbumsOnly();
            });
        });

        // Sort change
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSort = e.target.value;
                tracksPage = 1;
                const activeTab = document.querySelector('.filter-tab.active');
                const filter = activeTab?.dataset.filter || 'all';
                
                if (filter === 'all') renderAllContent();
                else if (filter === 'tracks') renderTracksOnly();
                else if (filter === 'albums') renderAlbumsOnly();
            });
        }

        // Load more buttons
        document.getElementById('load-more-tracks')?.addEventListener('click', () => {
            tracksPage++;
            renderAllContent();
        });

        document.getElementById('load-more-tracks-only')?.addEventListener('click', () => {
            tracksPage++;
            renderTracksOnly();
        });

        // Initial render
        renderAllContent();

        // Handle hash navigation
        if (window.location.hash === '#albums') {
            setTimeout(() => {
                document.querySelector('[data-filter="albums"]')?.click();
            }, 100);
        }
    }

    // ==========================================
    // Search Page
    // ==========================================

    function initSearchPage() {
        const input = document.getElementById('page-search');
        const emptyState = document.getElementById('search-empty');
        const noResults = document.getElementById('search-no-results');
        const trackResults = document.getElementById('results-tracks');
        const albumResults = document.getElementById('results-albums');
        const artistResults = document.getElementById('results-artists');

        if (!input) return;

        // Check for query parameter
        const urlQuery = Router.getParam('q');
        if (urlQuery) {
            input.value = urlQuery;
            performSearch(urlQuery);
        }

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            Router.updateParams({ q: query || null });
            
            if (query.length < 2) {
                hideAllResults();
                emptyState.style.display = 'flex';
                return;
            }

            Search.debouncedSearch(query, (results, q) => {
                performSearch(q, results);
            });
        });

        function performSearch(query, results = null) {
            if (!results) {
                results = Search.search(query);
            }

            const hasResults = results.tracks.length > 0 || 
                             results.albums.length > 0 || 
                             results.artists.length > 0;

            emptyState.style.display = 'none';
            
            if (!hasResults) {
                hideAllResults();
                document.getElementById('no-results-query').textContent = query;
                noResults.style.display = 'flex';
                return;
            }

            noResults.style.display = 'none';

            // Update subtitle
            const subtitle = document.getElementById('search-subtitle');
            if (subtitle) {
                const totalResults = results.tracks.length + results.albums.length;
                subtitle.textContent = `Found ${totalResults} result${totalResults !== 1 ? 's' : ''} for "${query}"`;
            }

            // Render tracks
            if (results.tracks.length > 0) {
                document.getElementById('results-tracks-list').innerHTML = 
                    results.tracks.map(t => createTrackListItem(t)).join('');
                trackResults.style.display = 'block';
            } else {
                trackResults.style.display = 'none';
            }

            // Render albums
            if (results.albums.length > 0) {
                document.getElementById('results-albums-list').innerHTML = 
                    results.albums.map(a => createAlbumCard(a)).join('');
                albumResults.style.display = 'block';
            } else {
                albumResults.style.display = 'none';
            }

            // Render artists
            if (results.artists.length > 0) {
                document.getElementById('results-artists-list').innerHTML = 
                    results.artists.map(artist => `
                        <a href="search.html?q=${encodeURIComponent(artist)}" class="artist-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            ${escapeHtml(artist)}
                        </a>
                    `).join('');
                artistResults.style.display = 'block';
            } else {
                artistResults.style.display = 'none';
            }
        }

        function hideAllResults() {
            trackResults.style.display = 'none';
            albumResults.style.display = 'none';
            artistResults.style.display = 'none';
            noResults.style.display = 'none';
        }
    }

    // ==========================================
    // Track Page
    // ==========================================

    function initTrackPage() {
        const trackId = Router.getParam('id');
        
        if (!trackId || !catalog) {
            showTrackError();
            return;
        }

        const track = catalog.tracks?.find(t => t.id === trackId);
        
        if (!track) {
            showTrackError();
            return;
        }

        // Update page title
        document.title = `${track.title} by ${track.artist} — NEUTRA`;

        // Hide loading, show content
        document.getElementById('track-loading').style.display = 'none';
        document.getElementById('track-content').style.display = 'block';

        // Populate track info
        document.getElementById('track-cover').src = track.cover || getPlaceholderImage();
        document.getElementById('track-cover').alt = track.title;
        document.getElementById('track-cover').onerror = function() { this.src = getPlaceholderImage(); };
        document.getElementById('track-title').textContent = track.title;
        document.getElementById('track-artist').textContent = track.artist;
        document.getElementById('track-duration').textContent = formatDuration(track.duration);

        // Album link
        const albumLink = document.getElementById('track-album-link');
        if (track.albumId) {
            const album = catalog.albums?.find(a => a.id === track.albumId);
            if (album) {
                albumLink.innerHTML = `From <a href="album.html?id=${album.id}">${escapeHtml(album.title)}</a>`;
            } else if (track.album) {
                albumLink.textContent = `From ${track.album}`;
            } else {
                albumLink.textContent = '';
            }
        } else if (track.album) {
            albumLink.textContent = `From ${track.album}`;
        } else {
            albumLink.textContent = 'Single';
        }

        // Platform buttons
        renderPlatformButtons(track.id, 'track-platforms');

        // UZT Player
        if (track.uzt) {
            initUZTPlayer(track);
        }

        // More from album
        if (track.albumId) {
            const albumTracks = catalog.tracks.filter(t => 
                t.albumId === track.albumId && t.id !== track.id
            );
            if (albumTracks.length > 0) {
                document.getElementById('more-from-album-section').style.display = 'block';
                document.getElementById('view-album-link').href = `album.html?id=${track.albumId}`;
                document.getElementById('more-from-album').innerHTML = 
                    albumTracks.slice(0, 5).map(t => createTrackListItem(t)).join('');
            }
        }

        // Similar tracks (same artist first, then random)
        const sameArtist = catalog.tracks
            .filter(t => t.id !== track.id && t.artist === track.artist)
            .slice(0, 4);
        
        const needed = 4 - sameArtist.length;
        const otherTracks = needed > 0 
            ? catalog.tracks
                .filter(t => t.id !== track.id && t.artist !== track.artist)
                .sort(() => Math.random() - 0.5)
                .slice(0, needed)
            : [];
        
        const similar = [...sameArtist, ...otherTracks];
        if (similar.length > 0) {
            document.getElementById('similar-tracks').innerHTML = 
                similar.map(t => createTrackCard(t)).join('');
        }
    }

    function showTrackError() {
        document.getElementById('track-loading').style.display = 'none';
        document.getElementById('track-error').style.display = 'flex';
    }

    function initUZTPlayer(track) {
        const section = document.getElementById('uzt-player-section');
        const audio = document.getElementById('uzt-audio');
        const playBtn = document.getElementById('uzt-play-btn');
        const playIcon = playBtn.querySelector('.play-icon');
        const pauseIcon = playBtn.querySelector('.pause-icon');
        const progressBar = document.getElementById('uzt-progress');
        const progressContainer = document.querySelector('.uzt-progress-bar');
        const currentTimeEl = document.getElementById('uzt-current-time');
        const totalTimeEl = document.getElementById('uzt-total-time');
        const volumeSlider = document.getElementById('uzt-volume');
        const muteBtn = document.getElementById('uzt-mute-btn');

        // Get UZT link from links.json
        const trackLinks = links?.tracks?.[track.id];
        if (!trackLinks?.uzt) {
            // No UZT audio file configured
            return;
        }

        // Show the player section
        section.style.display = 'block';
        audio.src = trackLinks.uzt;

        let lastVolume = 1;

        // Play/Pause
        playBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play().catch(err => console.error('Playback failed:', err));
            } else {
                audio.pause();
            }
        });

        audio.addEventListener('play', () => {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        });

        audio.addEventListener('pause', () => {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        });

        audio.addEventListener('ended', () => {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            progressBar.style.width = '0%';
        });

        // Metadata loaded
        audio.addEventListener('loadedmetadata', () => {
            totalTimeEl.textContent = formatDuration(audio.duration);
        });

        // Time update
        audio.addEventListener('timeupdate', () => {
            if (audio.duration) {
                const percent = (audio.currentTime / audio.duration) * 100;
                progressBar.style.width = `${percent}%`;
                currentTimeEl.textContent = formatDuration(audio.currentTime);
            }
        });

        // Progress bar click
        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (audio.duration) {
                audio.currentTime = percent * audio.duration;
            }
        });

        // Volume slider
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            audio.volume = volume;
            audio.muted = volume === 0;
            updateMuteIcon();
        });

        // Mute button
        muteBtn.addEventListener('click', () => {
            if (audio.muted || audio.volume === 0) {
                audio.muted = false;
                audio.volume = lastVolume > 0 ? lastVolume : 1;
                volumeSlider.value = audio.volume;
            } else {
                lastVolume = audio.volume;
                audio.muted = true;
                volumeSlider.value = 0;
            }
            updateMuteIcon();
        });

        function updateMuteIcon() {
            const isMuted = audio.muted || audio.volume === 0;
            muteBtn.style.opacity = isMuted ? '0.5' : '1';
        }

        // Error handling
        audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            section.innerHTML = `
                <div class="container">
                    <div class="uzt-player" style="text-align: center; padding: 2rem;">
                        <p style="color: var(--color-gray-500);">Unable to load audio. Please try again later.</p>
                    </div>
                </div>
            `;
        });
    }

    // ==========================================
    // Album Page
    // ==========================================

    function initAlbumPage() {
        const albumId = Router.getParam('id');
        
        if (!albumId || !catalog) {
            showAlbumError();
            return;
        }

        const album = catalog.albums?.find(a => a.id === albumId);
        
        if (!album) {
            showAlbumError();
            return;
        }

        // Update page title
        document.title = `${album.title} by ${album.artist} — NEUTRA`;

        // Hide loading, show content
        document.getElementById('album-loading').style.display = 'none';
        document.getElementById('album-content').style.display = 'block';

        // Populate album info
        document.getElementById('album-cover').src = album.cover || getPlaceholderImage();
        document.getElementById('album-cover').alt = album.title;
        document.getElementById('album-cover').onerror = function() { this.src = getPlaceholderImage(); };
        document.getElementById('album-title').textContent = album.title;
        document.getElementById('album-artist').textContent = album.artist;
        document.getElementById('album-year').textContent = album.year || '';

        // Get album tracks
        const albumTracks = catalog.tracks?.filter(t => t.albumId === albumId) || [];
        
        // Sort by track number if available
        albumTracks.sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));

        // Album stats
        document.getElementById('album-track-count').textContent = 
            `${albumTracks.length} track${albumTracks.length !== 1 ? 's' : ''}`;
        document.getElementById('album-duration').textContent = calculateTotalDuration(albumTracks);

        // Platform buttons
        renderAlbumPlatformButtons(album.id, 'album-platforms');

        // Tracklist
        const tracklistContainer = document.getElementById('album-tracks');
        if (albumTracks.length > 0) {
            tracklistContainer.innerHTML = albumTracks.map((track, index) => `
                <a href="track.html?id=${track.id}" class="tracklist-item">
                    <span class="tracklist-item-num">${track.trackNumber || index + 1}</span>
                    <span class="tracklist-item-title">
                        ${escapeHtml(track.title)}
                        ${track.uzt ? '<span class="uzt-indicator">UZT</span>' : ''}
                    </span>
                    <span class="tracklist-item-duration">${formatDuration(track.duration)}</span>
                </a>
            `).join('');
        } else {
            tracklistContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--color-gray-500);">
                    No tracks available for this album.
                </div>
            `;
        }

        // More from artist
        const moreAlbums = catalog.albums.filter(a => 
            a.id !== album.id && a.artist === album.artist
        );
        
        if (moreAlbums.length > 0) {
            document.getElementById('more-from-artist-section').style.display = 'block';
            document.getElementById('artist-name-more').textContent = album.artist;
            document.getElementById('more-from-artist').innerHTML = 
                moreAlbums.slice(0, 4).map(a => createAlbumCard(a)).join('');
        }
    }

    function showAlbumError() {
        document.getElementById('album-loading').style.display = 'none';
        document.getElementById('album-error').style.display = 'flex';
    }

    // ==========================================
    // UZT Page
    // ==========================================

    function initUZTPage() {
        if (!catalog) return;

        const uztTracks = catalog.tracks?.filter(t => t.uzt) || [];
        const container = document.getElementById('uzt-tracks');
        const emptyState = document.getElementById('uzt-empty');

        if (uztTracks.length === 0) {
            emptyState.style.display = 'flex';
            container.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = uztTracks.map(track => createUZTCard(track)).join('');
    }

    // ==========================================
    // Public API
    // ==========================================

    return {
        init,
        renderFeaturedTracks,
        renderLatestAlbums,
        renderTrendingTracks,
        initDiscoverPage,
        initSearchPage,
        initTrackPage,
        initAlbumPage,
        initUZTPage,
        
        // Expose utilities for potential extension
        utils: {
            escapeHtml,
            formatDuration,
            calculateTotalDuration,
            getPlaceholderImage
        },
        
        // Expose data getters
        getCatalog: () => catalog,
        getLinks: () => links
    };
})();

// Make globally available
window.NEUTRA = NEUTRA;
