import { MODAL_IDS, CSS_CLASSES } from './utils/Constants.js';

export class ModalManager {
    constructor(manager) {
        this.manager = manager;
        this.modals = {};
        this.initModals();
    }

    initModals() {
        // Initialize all modals
        const modalIds = Object.values(MODAL_IDS);

        modalIds.forEach(id => {
            this.modals[id] = document.getElementById(id);
        });

        this.setupModalListeners();
    }

    setupModalListeners() {
        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            Object.entries(this.modals).forEach(([id, modal]) => {
                if (event.target === modal) {
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
        if (this.modals[modalId]) {
            this.modals[modalId].style.display = 'block';
        }
    }

    hideModal(modalId) {
        if (this.modals[modalId]) {
            this.modals[modalId].style.display = 'none';
        }
    }
} 