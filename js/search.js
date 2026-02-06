/**
 * NEUTRA Search Module
 * High-performance client-side search with debouncing
 */
const Search = (function() {
    'use strict';

    let searchIndex = null;
    let debounceTimer = null;
    const DEBOUNCE_DELAY = 200;

    /**
     * Build search index from catalog data
     * @param {Object} catalog - Catalog data
     */
    function buildIndex(catalog) {
        searchIndex = {
            tracks: [],
            albums: [],
            artists: new Set()
        };

        // Index tracks
        if (catalog.tracks && Array.isArray(catalog.tracks)) {
            catalog.tracks.forEach(track => {
                searchIndex.tracks.push({
                    id: track.id,
                    title: track.title.toLowerCase(),
                    artist: track.artist.toLowerCase(),
                    album: (track.album || '').toLowerCase(),
                    original: track
                });
                searchIndex.artists.add(track.artist);
            });
        }

        // Index albums
        if (catalog.albums && Array.isArray(catalog.albums)) {
            catalog.albums.forEach(album => {
                searchIndex.albums.push({
                    id: album.id,
                    title: album.title.toLowerCase(),
                    artist: album.artist.toLowerCase(),
                    original: album
                });
                searchIndex.artists.add(album.artist);
            });
        }

        searchIndex.artists = Array.from(searchIndex.artists);
    }

    /**
     * Perform search query
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Object} Search results
     */
    function search(query, options = {}) {
        if (!searchIndex) {
            return { tracks: [], albums: [], artists: [] };
        }

        const q = query.toLowerCase().trim();
        if (!q) {
            return { tracks: [], albums: [], artists: [] };
        }

        const limit = options.limit || 50;
        const results = {
            tracks: [],
            albums: [],
            artists: []
        };

        // Search tracks
        const trackMatches = searchIndex.tracks.filter(track => 
            track.title.includes(q) || 
            track.artist.includes(q) || 
            track.album.includes(q)
        );
        
        // Score and sort tracks
        trackMatches.forEach(match => {
            let score = 0;
            if (match.title.startsWith(q)) score += 100;
            else if (match.title.includes(q)) score += 50;
            if (match.artist.startsWith(q)) score += 80;
            else if (match.artist.includes(q)) score += 40;
            if (match.album.includes(q)) score += 20;
            match.score = score;
        });
        
        trackMatches.sort((a, b) => b.score - a.score);
        results.tracks = trackMatches.slice(0, limit).map(m => m.original);

        // Search albums
        const albumMatches = searchIndex.albums.filter(album =>
            album.title.includes(q) || album.artist.includes(q)
        );
        
        albumMatches.forEach(match => {
            let score = 0;
            if (match.title.startsWith(q)) score += 100;
            else if (match.title.includes(q)) score += 50;
            if (match.artist.startsWith(q)) score += 80;
            else if (match.artist.includes(q)) score += 40;
            match.score = score;
        });
        
        albumMatches.sort((a, b) => b.score - a.score);
        results.albums = albumMatches.slice(0, limit).map(m => m.original);

        // Search artists
        results.artists = searchIndex.artists.filter(artist =>
            artist.toLowerCase().includes(q)
        ).slice(0, 10);

        return results;
    }

    /**
     * Debounced search
     * @param {string} query - Search query
     * @param {Function} callback - Callback with results
     * @param {Object} options - Search options
     */
    function debouncedSearch(query, callback, options = {}) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const results = search(query, options);
            callback(results, query);
        }, options.delay || DEBOUNCE_DELAY);
    }

    /**
     * Cancel pending search
     */
    function cancelSearch() {
        clearTimeout(debounceTimer);
    }

    /**
     * Highlight matching text
     * @param {string} text - Original text
     * @param {string} query - Search query
     * @returns {string} HTML with highlights
     */
    function highlight(text, query) {
        if (!query) return escapeHtml(text);
        const escaped = escapeHtml(text);
        const q = query.trim().toLowerCase();
        const regex = new RegExp(`(${escapeRegex(q)})`, 'gi');
        return escaped.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string}
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape regex special characters
     * @param {string} text - Text to escape
     * @returns {string}
     */
    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Check if index is built
     * @returns {boolean}
     */
    function isReady() {
        return searchIndex !== null;
    }

    // Public API
    return {
        buildIndex,
        search,
        debouncedSearch,
        cancelSearch,
        highlight,
        isReady
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Search;
}
