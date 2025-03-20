import { MODAL_IDS, CSS_CLASSES } from './utils/Constants.js';

export class ModalManager {
    constructor(manager) {
        this.manager = manager;
        this.modals = {};
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        // Initialize all modals
        const modalIds = Object.values(MODAL_IDS);
        let allModalsFound = true;

        modalIds.forEach(id => {
            const modal = document.getElementById(id);
            if (!modal) {
                console.error(`Modal with id ${id} not found`);
                allModalsFound = false;
            }
            this.modals[id] = modal;
        });

        if (!allModalsFound) {
            console.error('Some modals were not found. Modal functionality may be limited.');
        }

        this.setupEventListeners();
        this.initialized = true;
    }

    setupEventListeners() {
        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            Object.entries(this.modals).forEach(([id, modal]) => {
                if (modal && event.target === modal) {
                    this.hideModal(id);
                }
            });
        });

        // Add click handlers for cancel buttons
        document.querySelectorAll('.modal-cancel').forEach(button => {
            button.addEventListener('click', (event) => {
                const modal = event.target.closest(`.${CSS_CLASSES.MODAL_CONTENT}`).parentElement;
                if (modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    showModal(modalId) {
        const modal = this.modals[modalId];
        if (!modal) {
            console.error(`Modal with id ${modalId} not found`);
            return;
        }
        modal.style.display = 'block';
    }

    hideModal(modalId) {
        const modal = this.modals[modalId];
        if (!modal) {
            console.error(`Modal with id ${modalId} not found`);
            return;
        }
        modal.style.display = 'none';
    }
} 