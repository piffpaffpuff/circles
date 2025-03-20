import { CircleManager } from './CircleManager.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Check if d3 is loaded
    if (typeof d3 === 'undefined') {
        console.error('d3 is not loaded. Please check your script includes.');
        return;
    }

    // Initialize the CircleManager after DOM is loaded
    window.circleManager = new CircleManager();
}); 