import { ELEMENT_IDS, CSS_CLASSES, MODAL_IDS } from './utils/Constants.js';

export class SidebarManager {
    constructor(manager) {
        this.manager = manager;
    }

    init() {
        // Initialize sidebar
        const root = d3.hierarchy(this.manager.companyData);
        this.updateSidebar(root);
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
        const root = d3.hierarchy(this.manager.companyData);
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
            this.manager.memberManager.membersData.members.forEach(member => {
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
        const root = d3.hierarchy(this.manager.companyData);
        const circleNode = root.descendants().find(n => n.data.id === node.data.id);
        
        if (!circleNode) return null;

        // Search through all descendants of the circle
        return circleNode.descendants().find(n => 
            n.data.isRole && 
            n.data.members && 
            n.data.members.includes(memberId)
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
                this.manager.clickedNodeData = node.data;
                this.manager.modalManager.showModal(MODAL_IDS.NEW_CIRCLE);
            });
        }

        if (addRoleBtn) {
            addRoleBtn.addEventListener('click', () => {
                this.manager.clickedNodeData = node.data;
                this.manager.modalManager.showModal(MODAL_IDS.NEW_ROLE);
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
                this.manager.modalManager.showModal(MODAL_IDS.EDIT_CIRCLE);
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
                this.manager.modalManager.showModal(MODAL_IDS.EDIT_ROLE);
            });
        }

        if (assignMembersBtn) {
            assignMembersBtn.addEventListener('click', () => {
                this.manager.memberManager.showAssignMembersModal(node.data);
            });
        }

        // Add event listeners for remove member buttons
        document.querySelectorAll('.remove-member').forEach(button => {
            button.addEventListener('click', () => {
                const memberId = button.dataset.memberId;
                this.manager.memberManager.removeAssignment(memberId, node.data.id);
                this.updateSidebar(node);
            });
        });
    }

    populateParentSelect(selectId, currentNode) {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Move to another circle...</option>';
        
        const root = d3.hierarchy(this.manager.companyData);
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
} 