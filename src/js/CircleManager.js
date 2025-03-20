import { VisualizationModule } from './VisualizationModule.js';
import { MemberManager } from './MemberManager.js';
import { RoleTemplateManager } from './RoleTemplateManager.js';
import { RoleManager } from './RoleManager.js';
import { ModalManager } from './ModalManager.js';
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
        this.visualization = new VisualizationModule(this);
        this.memberManager = new MemberManager(this);
        this.templateManager = new RoleTemplateManager(this);
        this.roleManager = new RoleManager(this);
        this.modalManager = new ModalManager(this);

        // Initialize
        this.init();
    }

    init() {
        this.loadFromLocalStorage();
        this.addIdsToGroups(this.companyData);
        this.visualization.init();
        this.memberManager.init();
        this.templateManager.init();
        this.roleManager.init();
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
                    this.updateSidebar(currentNode);
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
        this.visualization.renderVisualization();
        const root = d3.hierarchy(this.companyData);
        this.currentSelectedNode = root;
        this.clickedNodeData = root.data;
        this.updateSidebar(root);
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

    updateSidebar(node) {
        const sidebar = document.getElementById(ELEMENT_IDS.SIDEBAR);
        const controlsRight = document.querySelector('.controls-right');
        
        // Clear previous content
        controlsRight.innerHTML = '';
        
        if (!node) {
            sidebar.innerHTML = `
                <h2>Company Structure</h2>
                <div class="sidebar-placeholder">
                    Click on a circle to view details
                </div>
            `;
            return;
        }

        const data = node.data;
        let html = `
            <h2>${data.name}</h2>
            ${data.description ? `<p class="description">${data.description}</p>` : ''}
            ${data.driver ? `<p class="driver"><strong>Driver:</strong> ${data.driver}</p>` : ''}
        `;

        // Get all roles in the circle
        const root = d3.hierarchy(this.companyData);
        const circleNode = root.descendants().find(n => n.data.id === node.data.id);
        
        if (circleNode) {
            // Get all roles in the circle
            const roles = circleNode.descendants().filter(n => n.data.isRole || n.data.isTemplate);
            
            // Sort roles: template roles first, then regular roles
            const sortedRoles = roles.sort((a, b) => {
                if (a.data.isTemplate && !b.data.isTemplate) return -1;
                if (!a.data.isTemplate && b.data.isTemplate) return 1;
                return a.data.name.localeCompare(b.data.name);
            });

            // Group members by role
            const membersByRole = {};
            this.memberManager.membersData.members.forEach(member => {
                const role = this.findMemberRole(member.id, node);
                const roleName = role ? role.data.name : 'Unassigned';
                if (!membersByRole[roleName]) {
                    membersByRole[roleName] = [];
                }
                membersByRole[roleName].push(member);
            });

            // If this is the root node (company), show only template roles and unassigned members
            if (!node.parent) {
                const templateRoles = sortedRoles.filter(role => role.data.isTemplate);
                const unassignedMembers = membersByRole['Unassigned'] || [];

                html += `
                    <div class="members-section">
                        <h3>Members</h3>
                        ${templateRoles.map(role => `
                            <div class="role-group">
                                <h4>${role.data.name}</h4>
                                <div class="assigned-members">
                                    ${(membersByRole[role.data.name] || []).map(member => `
                                        <div class="${CSS_CLASSES.ASSIGNED_MEMBER}">
                                            <span>${member.name}</span>
                                            <button class="remove-member" data-member-id="${member.id}">Remove</button>
                                        </div>
                                    `).join('')}
                                    ${(!membersByRole[role.data.name] || membersByRole[role.data.name].length === 0) ? 
                                        `<div class="${CSS_CLASSES.ASSIGNED_MEMBER}"><em>No members assigned</em></div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                        
                        <div class="role-group">
                            <h4>Unassigned Members</h4>
                            <div class="assigned-members">
                                ${unassignedMembers.map(member => `
                                    <div class="${CSS_CLASSES.ASSIGNED_MEMBER}">
                                        <span>${member.name}</span>
                                        <button class="remove-member" data-member-id="${member.id}">Remove</button>
                                    </div>
                                `).join('')}
                                ${unassignedMembers.length === 0 ? 
                                    `<div class="${CSS_CLASSES.ASSIGNED_MEMBER}"><em>No unassigned members</em></div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // For non-root nodes, show all roles and their members
                html += `
                    <div class="members-section">
                        <h3>Members</h3>
                        ${sortedRoles.map(role => `
                            <div class="role-group">
                                <h4>${role.data.name}</h4>
                                <div class="assigned-members">
                                    ${(membersByRole[role.data.name] || []).map(member => `
                                        <div class="${CSS_CLASSES.ASSIGNED_MEMBER}">
                                            <span>${member.name}</span>
                                            <button class="remove-member" data-member-id="${member.id}">Remove</button>
                                        </div>
                                    `).join('')}
                                    ${(!membersByRole[role.data.name] || membersByRole[role.data.name].length === 0) ? 
                                        `<div class="${CSS_CLASSES.ASSIGNED_MEMBER}"><em>No members assigned</em></div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                        
                        <div class="role-group">
                            <h4>Unassigned</h4>
                            <div class="assigned-members">
                                ${(membersByRole['Unassigned'] || []).map(member => `
                                    <div class="${CSS_CLASSES.ASSIGNED_MEMBER}">
                                        <span>${member.name}</span>
                                        <button class="remove-member" data-member-id="${member.id}">Remove</button>
                                    </div>
                                `).join('')}
                                ${(!membersByRole['Unassigned'] || membersByRole['Unassigned'].length === 0) ? 
                                    `<div class="${CSS_CLASSES.ASSIGNED_MEMBER}"><em>No unassigned members</em></div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        sidebar.innerHTML = html;

        // Add action buttons to controls-right based on node type
        if (data.isRole || data.isTemplate) {
            controlsRight.innerHTML = `
                <button id="edit-role-btn" class="${CSS_CLASSES.ACTION_BTN}">Edit Role</button>
                <button id="assign-members-btn" class="${CSS_CLASSES.ACTION_BTN}">Assign Members</button>
            `;
        } else {
            controlsRight.innerHTML = `
                <button id="add-circle-btn" class="${CSS_CLASSES.ACTION_BTN}">Add Circle</button>
                <button id="add-role-btn" class="${CSS_CLASSES.ACTION_BTN}">Add Role</button>
                <button id="edit-circle-btn" class="${CSS_CLASSES.ACTION_BTN}">Edit Circle</button>
                <button id="assign-members-btn" class="${CSS_CLASSES.ACTION_BTN}">Assign Members</button>
            `;
        }

        // Add event listeners for the new buttons
        this.setupSidebarEventListeners(node);
    }

    findMemberRole(memberId, node) {
        // Search through all roles in the circle and its children
        const root = d3.hierarchy(this.companyData);
        const circleNode = root.descendants().find(n => n.data.id === node.data.id);
        
        if (!circleNode) return null;

        // Search through all descendants of the circle
        return circleNode.descendants().find(n => 
            n.data.isRole && 
            n.data.members && 
            n.data.members.includes(memberId)
        );
    }

    findRoleByName(roleName, node) {
        // Search through all roles in the circle and its children
        const root = d3.hierarchy(this.companyData);
        const circleNode = root.descendants().find(n => n.data.id === node.data.id);
        
        if (!circleNode) return null;

        // Search through all descendants of the circle
        return circleNode.descendants().find(n => 
            n.data.isRole && 
            n.data.name === roleName
        );
    }

    setupSidebarEventListeners(node) {
        const addCircleBtn = document.getElementById('add-circle-btn');
        const addRoleBtn = document.getElementById('add-role-btn');
        const editCircleBtn = document.getElementById('edit-circle-btn');
        const editRoleBtn = document.getElementById('edit-role-btn');
        const assignMembersBtn = document.getElementById('assign-members-btn');

        if (addCircleBtn) {
            addCircleBtn.addEventListener('click', () => {
                this.clickedNodeData = node.data;
                this.modalManager.showModal(MODAL_IDS.NEW_CIRCLE);
            });
        }

        if (addRoleBtn) {
            addRoleBtn.addEventListener('click', () => {
                this.clickedNodeData = node.data;
                this.modalManager.showModal(MODAL_IDS.NEW_ROLE);
            });
        }

        if (editCircleBtn) {
            editCircleBtn.addEventListener('click', () => {
                const editNameInput = document.getElementById('edit-circle-name');
                const editDescInput = document.getElementById('edit-circle-description');
                const editDriverInput = document.getElementById('edit-circle-driver');
                
                editNameInput.value = node.data.name;
                editDescInput.value = node.data.description || '';
                editDriverInput.value = node.data.driver || '';
                
                this.populateParentSelect('edit-circle-parent', node);
                this.modalManager.showModal(MODAL_IDS.EDIT_CIRCLE);
            });
        }

        if (editRoleBtn) {
            editRoleBtn.addEventListener('click', () => {
                const editNameInput = document.getElementById('edit-role-name');
                const editDescInput = document.getElementById('edit-role-description');
                const editDriverInput = document.getElementById('edit-role-driver');
                
                editNameInput.value = node.data.name;
                editDescInput.value = node.data.description || '';
                editDriverInput.value = node.data.driver || '';
                
                this.populateParentSelect('edit-role-parent', node);
                this.modalManager.showModal(MODAL_IDS.EDIT_ROLE);
            });
        }

        if (assignMembersBtn) {
            assignMembersBtn.addEventListener('click', () => {
                this.memberManager.showAssignMembersModal(node.data);
            });
        }

        // Add event listeners for remove member buttons
        document.querySelectorAll('.remove-member').forEach(button => {
            button.addEventListener('click', () => {
                const memberId = button.dataset.memberId;
                this.memberManager.removeAssignment(memberId, node.data.id);
                this.updateSidebar(node);
            });
        });

        // Add delete circle button handler
        const deleteCircleBtn = document.getElementById('delete-circle');
        if (deleteCircleBtn) {
            // Remove old event listener if it exists
            if (this.deleteCircleBound) {
                deleteCircleBtn.removeEventListener('click', this.deleteCircleHandler);
            }

            // Create a new handler function
            this.deleteCircleHandler = () => {
                // Check if we're trying to delete the root node
                if (!node.parent) {
                    alert('Cannot delete the root node.');
                    return;
                }

                // Get the current node from the hierarchy
                const root = d3.hierarchy(this.companyData);
                const currentNode = root.descendants().find(n => n.data.id === node.data.id);
                
                if (currentNode) {
                    this.deleteCircle(currentNode);
                }
            };

            // Add the new event listener
            deleteCircleBtn.addEventListener('click', this.deleteCircleHandler);
            this.deleteCircleBound = true;
        }
    }

    populateParentSelect(selectId, currentNode) {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Move to another circle...</option>';
        
        const root = d3.hierarchy(this.companyData);
        root.descendants().forEach(node => {
            if (!node.data.isRole && node !== currentNode && !this.isDescendant(node, currentNode)) {
                const option = document.createElement('option');
                option.value = node.data.id;
                option.textContent = node.data.name;
                select.appendChild(option);
            }
        });
    }

    isDescendant(parent, child) {
        let node = child.parent;
        while (node) {
            if (node === parent) return true;
            node = node.parent;
        }
        return false;
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
                this.updateSidebar(parent);
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
            this.updateSidebar(newNode);
        }

        return newCircle;
    }
} 