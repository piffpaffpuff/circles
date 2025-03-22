import { VisualizationModule } from './VisualizationModule.js';
import { MemberManager } from './MemberManager.js';
import { RoleTemplateManager } from './RoleTemplateManager.js';
import { RoleManager } from './RoleManager.js';
import { ModalManager } from './ModalManager.js';
import { SidebarManager } from './SidebarManager.js';
import { STORAGE_KEYS, ELEMENT_IDS, MODAL_IDS, CSS_CLASSES } from './utils/Constants.js';

export class CircleManager {
    constructor() {
        // State
        this.companyData = {
            name: "Company",
            description: "Organizational structure visualization",
            children: []
        };
        this.currentSelectedNode = null;
        this.clickedNodeData = null;
        this.svg = null;
        this.g = null;
        this.pack = null;
        this.view = null;
        this.width = 0;
        this.height = 0;
        this.confirmAddCircleBound = false;  // Flag to track if event listener is bound
        this.deleteCircleBound = false;      // Flag to track if delete button event listener is bound

        // Initialize modules
        this.modalManager = new ModalManager(this);
        this.visualization = new VisualizationModule(this);
        this.memberManager = new MemberManager(this);
        this.templateManager = new RoleTemplateManager(this);
        this.roleManager = new RoleManager(this);
        this.sidebarManager = new SidebarManager(this);

        // Initialize
        this.init();
    }

    init() {
        // Load data first
        this.loadFromLocalStorage();
        this.addIdsToGroups(this.companyData);

        // Initialize managers in correct order
        this.modalManager.init();
        this.visualization.init();
        this.memberManager.init();
        this.templateManager.init();
        this.roleManager.init();
        this.sidebarManager.init();

        // Setup event listeners last
        this.setupEventListeners();
        this.setupModalEventListeners();
    }

    setupEventListeners() {
        // Global event listeners
        window.addEventListener('resize', this.handleResize.bind(this));
        document.getElementById('reset-btn').addEventListener('click', this.handleReset.bind(this));
    }

    setupModalEventListeners() {
        // Add new circle confirmation handler
        const confirmAddCircleBtn = document.getElementById('confirm-add-circle');
        if (confirmAddCircleBtn && !this.confirmAddCircleBound) {
            confirmAddCircleBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('circle-name');
                const descInput = document.getElementById('circle-description');
                const driverInput = document.getElementById('circle-driver');

                if (!nameInput.value.trim()) {
                    alert('Please enter a circle name.');
                    return;
                }

                this.addCircle(
                    nameInput.value.trim(),
                    descInput.value.trim(),
                    driverInput.value.trim()
                );

                // Clear inputs and close modal
                nameInput.value = '';
                descInput.value = '';
                driverInput.value = '';
                this.modalManager.hideModal(MODAL_IDS.NEW_CIRCLE);
            });
            this.confirmAddCircleBound = true;
        }

        // Add edit circle confirmation handler
        const confirmEditCircleBtn = document.getElementById('confirm-edit-circle');
        if (confirmEditCircleBtn) {
            confirmEditCircleBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('edit-circle-name');
                const descInput = document.getElementById('edit-circle-description');
                const driverInput = document.getElementById('edit-circle-driver');
                const parentSelect = document.getElementById('edit-circle-parent');

                if (!nameInput.value.trim()) {
                    alert('Please enter a circle name.');
                    return;
                }

                // Get the current node from the hierarchy
                const root = d3.hierarchy(this.companyData);
                const currentNode = root.descendants().find(n => n.data.id === this.clickedNodeData.id);

                if (currentNode) {
                    // Update the node's data
                    currentNode.data.name = nameInput.value.trim();
                    currentNode.data.description = descInput.value.trim();
                    currentNode.data.driver = driverInput.value.trim();

                    // Handle parent change if selected
                    if (parentSelect.value) {
                        const newParent = root.descendants().find(n => n.data.id === parentSelect.value);
                        if (newParent && newParent !== currentNode) {
                            // Remove from current parent
                            const currentParent = currentNode.parent;
                            if (currentParent && currentParent.data.children) {
                                const indexToRemove = currentParent.data.children.findIndex(child => child.id === currentNode.data.id);
                                if (indexToRemove > -1) {
                                    currentParent.data.children.splice(indexToRemove, 1);
                                }
                            }

                            // Add to new parent
                            if (!newParent.data.children) {
                                newParent.data.children = [];
                            }
                            newParent.data.children.push(currentNode.data);
                        }
                    }

                    // Save changes and update visualization
                    this.saveToLocalStorage();
                    this.visualization.renderVisualization();
                    this.modalManager.hideModal(MODAL_IDS.EDIT_CIRCLE);

                    // Update sidebar and zoom to the updated node
                    this.sidebarManager.updateSidebar(currentNode);
                    this.visualization.zoomTo(currentNode);
                }
            });
        }
    }

    handleResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            const container = document.getElementById(ELEMENT_IDS.CIRCLE_PACKING);
            if (container) {
                this.width = container.clientWidth || 800;
                this.height = container.clientHeight || 600;
                this.visualization.init();
            }
        }, 250);
    }

    handleReset() {
        this.visualization.handleReset();
    }

    saveToLocalStorage() {
        const dataToSave = {
            companyData: this.companyData,
            membersData: this.memberManager.membersData,
            templatesData: this.templateManager.templatesData || { templates: [] }
        };
        localStorage.setItem(STORAGE_KEYS.ORGANIZATION_DATA, JSON.stringify(dataToSave));
    }

    loadFromLocalStorage() {
        const savedData = localStorage.getItem(STORAGE_KEYS.ORGANIZATION_DATA);
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            Object.assign(this.companyData, parsedData.companyData);
            this.memberManager.loadData(parsedData.membersData);
            this.templateManager.loadData(parsedData.templatesData);
        }
    }

    addIdsToGroups(node) {
        node.id = node.id || this.generateId();
        if (node.children) {
            node.children.forEach(child => this.addIdsToGroups(child));
        }
    }

    generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    findGroupById(id, node) {
        if (node.id === id) {
            return node;
        }
        if (node.children) {
            for (const child of node.children) {
                const found = this.findGroupById(id, child);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    deleteCircle(node) {
        // Prevent deleting the root node
        if (!node || !node.parent) {
            alert('Cannot delete the root node.');
            return;
        }

        // Confirm deletion
        if (!confirm('Are you sure you want to delete this circle and all its children?')) {
            return;
        }

        // Remove the node from its parent's children
        const parent = node.parent;
        if (parent && parent.data && parent.data.children) {
            const indexToRemove = parent.data.children.findIndex(child => child.id === node.data.id);
            if (indexToRemove > -1) {
                // Remove the node from its parent's children array
                parent.data.children.splice(indexToRemove, 1);

                // Save to localStorage
                this.saveToLocalStorage();

                // Re-render visualization
                this.visualization.renderVisualization();

                // Close modal
                this.modalManager.hideModal(MODAL_IDS.EDIT_CIRCLE);

                // Zoom to the parent node
                this.visualization.zoomTo(parent);
                this.sidebarManager.updateSidebar(parent);
            }
        }
    }

    addCircle(name, description, driver) {
        if (!this.clickedNodeData) {
            alert('Please select a parent circle first.');
            return null;
        }

        const newCircle = {
            name: name,
            description: description === '' ? '' : description,
            driver: driver === '' ? '' : driver,
            id: this.generateId(),
            isGroup: true,    // Mark as a group/circle node
            isRole: false,    // Explicitly mark as not a role
            children: []
        };

        if (!this.clickedNodeData.children) {
            this.clickedNodeData.children = [];
        }

        this.clickedNodeData.children.push(newCircle);

        // Add all existing templates as leaf nodes to the new circle
        this.templateManager.templatesData.templates.forEach(template => {
            const templateNode = {
                name: template.name,
                description: template.description || '',
                driver: template.driver || '',
                id: this.generateId(),
                isGroup: false,
                isRole: false,
                isTemplate: true,
                templateId: template.id,
                children: []
            };
            newCircle.children.push(templateNode);
        });

        this.saveToLocalStorage();
        this.visualization.renderVisualization();

        // Find the new node in the hierarchy and update the view
        const newRoot = d3.hierarchy(this.companyData);
        const newNode = newRoot.descendants().find(node => 
            node.data === this.clickedNodeData
        );

        // Select and zoom to the node
        if (newNode) {
            this.currentSelectedNode = newNode;
            this.visualization.view = newNode;
            this.visualization.zoomTo(newNode);
            this.sidebarManager.updateSidebar(newNode);
        }

        return newCircle;
    }
} 