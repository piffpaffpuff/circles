import { MODAL_IDS } from './utils/Constants.js';

export class RoleManager {
    constructor(manager) {
        this.manager = manager;
    }

    resetModal() {
        // Reset form fields
        document.getElementById('role-name').value = '';
        document.getElementById('role-description').value = '';
        document.getElementById('role-driver').value = '';

        // Reset toggle buttons and display states
        const toggleButtons = document.querySelectorAll('.role-type-toggle .toggle-btn');
        const roleForm = document.querySelector('.role-form');
        const templateSelection = document.querySelector('.template-selection');
        const confirmButton = document.getElementById('confirm-add-role');
        
        // Set "New Role" as active
        toggleButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'new');
        });
        
        // Show role form, hide template selection
        roleForm.style.display = 'block';
        templateSelection.style.display = 'none';
        confirmButton.textContent = 'Add Role';

        // Update templates list
        this.updateRoleTemplatesList();
    }

    init() {
        // Add Role button handler
        const addRoleBtn = document.getElementById('add-role-btn');
        if (addRoleBtn) {
            addRoleBtn.addEventListener('click', () => {
                this.manager.modalManager.showModal(MODAL_IDS.NEW_ROLE);
                this.resetModal();
            });
        }

        // Set up role type toggle handlers
        const roleTypeToggle = document.querySelector('.role-type-toggle');
        if (roleTypeToggle) {
            const roleForm = document.querySelector('.role-form');
            const templateSelection = document.querySelector('.template-selection');
            const confirmButton = document.getElementById('confirm-add-role');

            roleTypeToggle.addEventListener('click', (e) => {
                const button = e.target.closest('.toggle-btn');
                if (!button) return;

                console.log('Toggle button clicked:', button.dataset.type);
                e.preventDefault();
                e.stopPropagation();
                
                // Update active state and display
                const isTemplateMode = button.dataset.type === 'template';
                roleTypeToggle.querySelectorAll('.toggle-btn').forEach(btn => 
                    btn.classList.toggle('active', btn === button)
                );
                
                roleForm.style.display = isTemplateMode ? 'none' : 'block';
                templateSelection.style.display = isTemplateMode ? 'block' : 'none';
                confirmButton.textContent = isTemplateMode ? 'Add from Template' : 'Add Role';

                if (isTemplateMode) {
                    this.updateRoleTemplatesList();
                }
            });
        }

        this.setupEventListeners();
    }

    updateRoleTemplatesList() {
        console.log('Updating role templates list...');
        const container = document.getElementById('role-templates-list');
        if (!container) {
            console.error('Templates list container not found');
            return;
        }

        container.innerHTML = '';

        // Get all existing role names in the current circle
        const existingRoleNames = new Set();
        if (this.manager.clickedNodeData && this.manager.clickedNodeData.children) {
            this.manager.clickedNodeData.children
                .filter(child => child.isRole)
                .forEach(role => existingRoleNames.add(role.name.toLowerCase()));
        }

        console.log('Current circle:', this.manager.clickedNodeData);
        console.log('Existing role names:', Array.from(existingRoleNames));
        console.log('Templates data:', this.manager.templateManager.templatesData);
        console.log('Available templates:', this.manager.templateManager.templatesData.templates);

        // Ensure templates array exists
        if (!this.manager.templateManager.templatesData.templates) {
            console.error('Templates array is undefined');
            container.innerHTML = '<div class="template-item"><em>No templates available</em></div>';
            return;
        }

        // Filter out templates that already exist in the circle
        const availableTemplates = this.manager.templateManager.templatesData.templates
            .filter(template => !existingRoleNames.has(template.name.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));

        console.log('Filtered available templates:', availableTemplates);

        if (availableTemplates.length === 0) {
            container.innerHTML = '<div class="template-item"><em>No available templates</em></div>';
            return;
        }

        availableTemplates.forEach(template => {
            const templateElement = document.createElement('div');
            templateElement.className = 'template-item';
            templateElement.innerHTML = `
                <div>
                    <strong>${template.name}</strong>
                    ${template.description ? `<p class="description">${template.description}</p>` : ''}
                </div>
            `;

            templateElement.addEventListener('click', () => {
                // Remove selection from other templates
                container.querySelectorAll('.template-item').forEach(item => {
                    item.classList.remove('selected');
                });
                // Add selection to clicked template
                templateElement.classList.add('selected');
            });

            container.appendChild(templateElement);
        });
    }

    addRole(name, description, driver) {
        if (!this.manager.clickedNodeData) {
            alert('Please select a circle first.');
            return null;
        }

        const newRole = {
            name: name,
            description: description === '' ? '' : description,
            driver: driver === '' ? '' : driver,
            id: this.manager.generateId(),
            isRole: true
        };

        if (!this.manager.clickedNodeData.children) {
            this.manager.clickedNodeData.children = [];
        }

        this.manager.clickedNodeData.children.push(newRole);
        this.manager.saveToLocalStorage();
        this.manager.visualization.renderVisualization();

        return newRole;
    }

    editRole(roleId, name, description, driver, newParentId) {
        const role = this.manager.currentSelectedNode.data;
        if (!role || !role.isRole) return false;

        role.name = name;
        role.description = description === '' ? '' : description;
        role.driver = driver === '' ? '' : driver;

        if (newParentId) {
            const oldParent = this.manager.currentSelectedNode.parent;
            const newParent = this.manager.findGroupById(newParentId, this.manager.companyData);
            
            if (newParent) {
                const existingRole = newParent.children ? 
                    newParent.children.find(child => 
                        child.isRole && 
                        child.name.toLowerCase() === name.toLowerCase() &&
                        child !== role
                    ) : null;

                if (existingRole) {
                    this.mergeRoles(role, existingRole, oldParent);
                } else {
                    this.moveRole(role, oldParent, newParent);
                }
            }
        }

        this.manager.saveToLocalStorage();
        this.manager.visualization.renderVisualization();
        return true;
    }

    mergeRoles(sourceRole, targetRole, oldParent) {
        if (sourceRole.members) {
            if (!targetRole.members) {
                targetRole.members = [];
            }
            sourceRole.members.forEach(memberId => {
                if (!targetRole.members.includes(memberId)) {
                    targetRole.members.push(memberId);
                    const member = this.manager.memberManager.membersData.members.find(m => m.id === memberId);
                    if (member) {
                        const oldAssignmentIndex = member.assignments.indexOf(sourceRole.id);
                        if (oldAssignmentIndex > -1) {
                            member.assignments.splice(oldAssignmentIndex, 1);
                        }
                        if (!member.assignments.includes(targetRole.id)) {
                            member.assignments.push(targetRole.id);
                        }
                    }
                }
            });
        }

        const oldParentChildren = oldParent.data.children;
        const indexToRemove = oldParentChildren.indexOf(sourceRole);
        if (indexToRemove > -1) {
            oldParentChildren.splice(indexToRemove, 1);
        }
    }

    moveRole(role, oldParent, newParent) {
        const oldParentChildren = oldParent.data.children;
        const indexToRemove = oldParentChildren.indexOf(role);
        if (indexToRemove > -1) {
            oldParentChildren.splice(indexToRemove, 1);
        }
        
        if (!newParent.children) {
            newParent.children = [];
        }
        newParent.children.push(role);
    }

    deleteRole(roleId) {
        const role = this.manager.currentSelectedNode.data;
        if (!role || !role.isRole) return false;

        const parent = this.manager.currentSelectedNode.parent;
        if (!parent) return false;

        // Remove any member assignments first
        if (role.members) {
            role.members.forEach(memberId => {
                const member = this.manager.memberManager.membersData.members.find(m => m.id === memberId);
                if (member) {
                    const assignmentIndex = member.assignments.indexOf(role.id);
                    if (assignmentIndex > -1) {
                        member.assignments.splice(assignmentIndex, 1);
                    }
                }
            });
        }

        const parentChildren = parent.data.children;
        const indexToRemove = parentChildren.indexOf(role);
        
        if (indexToRemove > -1) {
            parentChildren.splice(indexToRemove, 1);
            this.manager.saveToLocalStorage();
            this.manager.visualization.renderVisualization();
            return true;
        }
        return false;
    }

    setupEventListeners() {
        // Add role confirmation handler
        document.getElementById('confirm-add-role').addEventListener('click', () => {
            const isTemplateMode = document.querySelector('.toggle-btn[data-type="template"]').classList.contains('active');
            
            if (isTemplateMode) {
                const selectedTemplate = document.querySelector('#role-templates-list .template-item.selected');
                if (!selectedTemplate) {
                    alert('Please select a template.');
                    return;
                }
                const templateName = selectedTemplate.querySelector('strong').textContent;
                const template = this.manager.templateManager.templatesData.templates.find(t => t.name === templateName);
                if (template) {
                    this.addRoleFromTemplate(template);
                }
            } else {
                const name = document.getElementById('role-name').value.trim();
                if (!name) {
                    alert('Please enter a role name.');
                    return;
                }
                this.addRole(name, 
                    document.getElementById('role-description').value.trim(),
                    document.getElementById('role-driver').value.trim()
                );
            }
            
            this.resetModal();
            this.manager.modalManager.hideModal(MODAL_IDS.NEW_ROLE);
        });

        // Edit role confirmation handler
        document.getElementById('confirm-edit-role').addEventListener('click', () => {
            const name = document.getElementById('edit-role-name').value.trim();
            const description = document.getElementById('edit-role-description').value.trim();
            const driver = document.getElementById('edit-role-driver').value.trim();
            const newParentId = document.getElementById('edit-role-parent').value;

            if (!name) {
                alert('Please enter a role name.');
                return;
            }

            if (this.editRole(null, name, description, driver, newParentId)) {
                this.manager.modalManager.hideModal(MODAL_IDS.EDIT_ROLE);
            }
        });

        // Delete role handler
        document.getElementById('delete-role').addEventListener('click', () => {
            if (!confirm('Are you sure you want to delete this role?')) {
                return;
            }

            if (this.deleteRole()) {
                this.manager.modalManager.hideModal(MODAL_IDS.EDIT_ROLE);
                
                if (this.manager.currentSelectedNode.parent) {
                    const parent = this.manager.currentSelectedNode.parent;
                    this.manager.currentSelectedNode = parent;
                    this.manager.clickedNodeData = parent.data;
                    this.manager.visualization.zoomTo(parent);
                    this.manager.sidebarManager.updateSidebar(parent);
                }
            }
        });
    }

    addRoleFromTemplate(template) {
        const newRole = {
            name: template.name,
            description: template.description || '',
            driver: template.driver || '',
            id: this.manager.generateId(),
            isGroup: false,
            isRole: true,
            templateId: template.id,
            members: []
        };

        if (!this.manager.clickedNodeData.children) {
            this.manager.clickedNodeData.children = [];
        }

        this.manager.clickedNodeData.children.push(newRole);
        this.manager.saveToLocalStorage();
        this.manager.visualization.renderVisualization();

        // Find the new node in the hierarchy and update the view
        const newRoot = d3.hierarchy(this.manager.companyData);
        const newNode = newRoot.descendants().find(node => 
            node.data === this.manager.clickedNodeData
        );

        // Select and zoom to the node
        if (newNode) {
            this.manager.currentSelectedNode = newNode;
            this.manager.visualization.view = newNode;
            this.manager.visualization.zoomTo(newNode);
            this.manager.sidebarManager.updateSidebar(newNode);
        }
    }
} 