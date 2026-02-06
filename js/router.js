/**
 * NEUTRA Router Module
 * Handles URL parameters and page routing
 */
const Router = (function() {
    'use strict';

    /**
     * Parse URL query parameters
     * @returns {URLSearchParams}
     */
    function getParams() {
        return new URLSearchParams(window.location.search);
    }

    /**
     * Get single parameter value
     * @param {string} key - Parameter key
     * @returns {string|null}
     */
    function getParam(key) {
        return getParams().get(key);
    }

    /**
     * Build URL with parameters
     * @param {string} base - Base URL
     * @param {Object} params - Parameters object
     * @returns {string}
     */
    function buildUrl(base, params) {
        const url = new URL(base, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            }
        });
        return url.toString();
    }

    /**
     * Navigate to URL
     * @param {string} url - Target URL
     */
    function navigate(url) {
        window.location.href = url;
    }

    /**
     * Get current page name
     * @returns {string}
     */
    function getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page.replace('.html', '');
    }

    /**
     * Update URL without reload
     * @param {Object} params - Parameters to update
     */
    function updateParams(params) {
        const url = new URL(window.location.href);
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, value);
            }
        });
        window.history.replaceState({}, '', url.toString());
    }

    /**
     * Handle hash navigation
     * @param {string} hash - Target hash
     */
    function scrollToHash(hash) {
        if (!hash) return;
        const element = document.getElementById(hash.replace('#', ''));
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Public API
    return {
        getParams,
        getParam,
        buildUrl,
        navigate,
        getCurrentPage,
        updateParams,
        scrollToHash
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Router;
}
