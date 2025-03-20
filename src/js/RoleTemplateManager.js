import { MODAL_IDS, ELEMENT_IDS, CSS_CLASSES, DATA_ATTRIBUTES } from './utils/Constants.js';

export class RoleTemplateManager {
    constructor(manager) {
        this.manager = manager;
        this.templatesData = {
            templates: []
        };
        // Bind methods that will be used as callbacks
        this.editTemplate = this.editTemplate.bind(this);
    }

    init() {
        // Settings button handler
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.updateTemplatesList();
            this.manager.memberManager.updateMembersList();
            this.manager.modalManager.showModal(MODAL_IDS.SETTINGS);
        });

        // Add template button handler
        document.getElementById('add-template-btn').addEventListener('click', () => {
            this.manager.modalManager.showModal(MODAL_IDS.ADD_TEMPLATE);
        });

        this.setupEventListeners();
    }

    loadData(data) {
        console.log('Loading templates data:', data);
        if (data && data.templates) {
            this.templatesData = data;
            console.log('Loaded templates:', this.templatesData.templates);
        } else {
            // Initialize with empty templates array if no data
            this.templatesData = {
                templates: []
            };
            console.log('Initialized empty templates array');
        }
    }

    updateTemplatesList() {
        const container = document.getElementById(ELEMENT_IDS.TEMPLATES_CONTAINER);
        container.innerHTML = '';

        this.templatesData.templates
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(template => {
                const templateElement = document.createElement('div');
                templateElement.className = CSS_CLASSES.TEMPLATE_ITEM;
                templateElement.innerHTML = `
                    <div>
                        <strong>${template.name}</strong>
                        ${template.description ? `<br><small>${template.description}</small>` : ''}
                    </div>
                    <div class="template-actions">
                        <button class="template-edit">Edit</button>
                    </div>
                `;

                // Add event listener properly
                const editButton = templateElement.querySelector('.template-edit');
                editButton.addEventListener('click', () => {
                    // Populate edit modal with template data
                    const editNameInput = document.getElementById('edit-template-name');
                    const editDescInput = document.getElementById('edit-template-description');
                    const editModal = document.getElementById(MODAL_IDS.EDIT_TEMPLATE);
                    
                    editNameInput.value = template.name;
                    editDescInput.value = template.description || '';
                    editModal.dataset[DATA_ATTRIBUTES.TEMPLATE_ID] = template.id;
                    
                    this.manager.modalManager.showModal(MODAL_IDS.EDIT_TEMPLATE);
                });

                container.appendChild(templateElement);
            });
    }

    addTemplate(name, description) {
        // Check for duplicate names
        if (this.templatesData.templates.some(template => 
            template.name.toLowerCase() === name.toLowerCase()
        )) {
            alert('A template with this name already exists.');
            return null;
        }

        const newTemplate = {
            id: this.manager.generateId(),
            name: name,
            description: description
        };

        // Initialize templates array if it doesn't exist
        if (!this.templatesData.templates) {
            this.templatesData.templates = [];
        }

        this.templatesData.templates.push(newTemplate);

        // Add template as leaf node to all non-leaf nodes
        this.addTemplateToNode(this.manager.companyData, newTemplate);

        this.updateTemplatesList();
        this.manager.saveToLocalStorage();
        this.manager.visualization.renderVisualization();
        
        return newTemplate;
    }

    editTemplate(templateId, name, description) {
        const template = this.templatesData.templates.find(t => t.id === templateId);
        if (template) {
            // Check for duplicate names, excluding the current template
            if (this.templatesData.templates.some(t => 
                t.id !== templateId && 
                t.name.toLowerCase() === name.toLowerCase()
            )) {
                alert('A template with this name already exists.');
                return false;
            }

            template.name = name;
            template.description = description;

            // Update template nodes in the visualization
            this.updateTemplateInNode(this.manager.companyData, templateId, name, description);

            this.updateTemplatesList();
            this.manager.saveToLocalStorage();
            this.manager.visualization.renderVisualization();
            return true;
        }
        return false;
    }

    deleteTemplate(templateId) {
        const index = this.templatesData.templates.findIndex(t => t.id === templateId);
        if (index > -1) {
            // Remove template nodes from the visualization
            this.removeTemplateFromNode(this.manager.companyData, templateId);

            this.templatesData.templates.splice(index, 1);
            this.updateTemplatesList();
            this.manager.saveToLocalStorage();
            this.manager.visualization.renderVisualization();
            return true;
        }
        return false;
    }

    addTemplateToNode(node, template) {
        if (node.children && node.children.length > 0) {
            // Create template node
            const templateNode = {
                id: this.manager.generateId(),
                name: template.name,
                description: template.description,
                templateId: template.id
            };

            // Add to children
            node.children.push(templateNode);

            // Recursively add to children's children
            node.children.forEach(child => this.addTemplateToNode(child, template));
        }
    }

    updateTemplateInNode(node, templateId, name, description) {
        if (node.children && node.children.length > 0) {
            // Update template nodes with matching templateId
            node.children.forEach(child => {
                if (child.templateId === templateId) {
                    child.name = name;
                    child.description = description;
                }
            });
            
            // Recursively update in children
            node.children.forEach(child => this.updateTemplateInNode(child, templateId, name, description));
        }
    }

    removeTemplateFromNode(node, templateId) {
        if (node.children && node.children.length > 0) {
            // Remove template nodes with matching templateId
            node.children = node.children.filter(child => !child.templateId || child.templateId !== templateId);
            
            // Recursively remove from children
            node.children.forEach(child => this.removeTemplateFromNode(child, templateId));
        }
    }

    setupEventListeners() {
        // Add template confirmation handler
        document.getElementById('confirm-add-template').addEventListener('click', () => {
            const name = document.getElementById('template-name').value.trim();
            const description = document.getElementById('template-description').value.trim();

            if (!name) {
                alert('Please enter a template name.');
                return;
            }

            const newTemplate = this.addTemplate(name, description);
            if (newTemplate) {
                // Reset form and close modal
                document.getElementById('template-name').value = '';
                document.getElementById('template-description').value = '';
                this.manager.modalManager.hideModal(MODAL_IDS.ADD_TEMPLATE);
            }
        });

        // Edit template confirmation handler
        document.getElementById('confirm-edit-template').addEventListener('click', () => {
            const name = document.getElementById('edit-template-name').value.trim();
            const description = document.getElementById('edit-template-description').value.trim();
            const templateId = document.getElementById(MODAL_IDS.EDIT_TEMPLATE).dataset[DATA_ATTRIBUTES.TEMPLATE_ID];

            if (!name) {
                alert('Please enter a template name.');
                return;
            }

            if (this.editTemplate(templateId, name, description)) {
                this.manager.modalManager.hideModal(MODAL_IDS.EDIT_TEMPLATE);
            }
        });

        // Delete template handler
        document.getElementById('delete-template').addEventListener('click', () => {
            const templateId = document.getElementById(MODAL_IDS.EDIT_TEMPLATE).dataset[DATA_ATTRIBUTES.TEMPLATE_ID];
            
            if (confirm('Are you sure you want to delete this template? This will remove it from all circles.')) {
                if (this.deleteTemplate(templateId)) {
                    this.manager.modalManager.hideModal(MODAL_IDS.EDIT_TEMPLATE);
                }
            }
        });
    }
} 