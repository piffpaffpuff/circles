import { MODAL_IDS, ELEMENT_IDS, CSS_CLASSES, DATA_ATTRIBUTES } from './utils/Constants.js';

export class MemberManager {
    constructor(manager) {
        this.manager = manager;
        this.membersData = {
            members: []
        };
        // Bind methods that will be used as callbacks
        this.editMember = this.editMember.bind(this);
        this.toggleMemberAssignment = this.toggleMemberAssignment.bind(this);
    }

    init() {
        // Add Member button handler
        document.getElementById('add-member-btn').addEventListener('click', () => {
            this.manager.modalManager.showModal(MODAL_IDS.ADD_MEMBER);
        });

        this.setupEventListeners();
    }

    loadData(data) {
        if (data && data.members) {
            // Ensure all members have an assignments array
            data.members.forEach(member => {
                if (!member.assignments) {
                    member.assignments = [];
                }
            });
            this.membersData = data;
        }
    }

    updateMembersList() {
        const container = document.getElementById(ELEMENT_IDS.MEMBERS_CONTAINER);
        container.innerHTML = '';

        this.membersData.members
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(member => {
                const memberElement = document.createElement('div');
                memberElement.className = CSS_CLASSES.MEMBER_ITEM;
                memberElement.innerHTML = `
                    <div>
                        <strong>${member.name}</strong>
                        ${member.description ? `<p class="description">${member.description}</p>` : ''}
                    </div>
                    <div class="member-actions">
                        <button class="member-edit">Edit</button>
                        <button class="member-delete">Delete</button>
                    </div>
                `;
                // Add event listeners properly
                const editButton = memberElement.querySelector('.member-edit');
                const deleteButton = memberElement.querySelector('.member-delete');
                
                editButton.addEventListener('click', () => {
                    // Populate edit modal with member data
                    const editNameInput = document.getElementById('edit-member-name');
                    const editDescInput = document.getElementById('edit-member-description');
                    const editModal = document.getElementById(MODAL_IDS.EDIT_MEMBER);
                    
                    editNameInput.value = member.name;
                    editDescInput.value = member.description || '';
                    editModal.dataset[DATA_ATTRIBUTES.MEMBER_ID] = member.id;
                    
                    this.manager.modalManager.showModal(MODAL_IDS.EDIT_MEMBER);
                });

                deleteButton.addEventListener('click', () => {
                    if (confirm('Are you sure you want to delete this member?')) {
                        if (this.deleteMember(member.id)) {
                            this.updateMembersList();
                        }
                    }
                });

                container.appendChild(memberElement);
            });
    }

    showAssignMembersModal(groupData) {
        const container = document.getElementById(ELEMENT_IDS.ASSIGNABLE_MEMBERS);
        container.innerHTML = '';

        // Initialize members array if it doesn't exist
        if (!groupData.members) {
            groupData.members = [];
        }

        this.membersData.members
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(member => {
                const isAssigned = groupData.members.includes(member.id);
                const memberElement = document.createElement('div');
                memberElement.className = CSS_CLASSES.MEMBER_ITEM;
                memberElement.innerHTML = `
                    <div>
                        <strong>${member.name}</strong>
                        ${member.description ? `<p class="description">${member.description}</p>` : ''}
                    </div>
                    <button class="${isAssigned ? 'member-delete' : 'member-assign'}">${isAssigned ? 'Remove' : 'Assign'}</button>
                `;
                
                // Add event listener properly
                const actionButton = memberElement.querySelector('button');
                actionButton.addEventListener('click', () => {
                    this.toggleMemberAssignment(member.id, groupData.id);
                });
                
                container.appendChild(memberElement);
            });

        this.manager.modalManager.showModal(MODAL_IDS.ASSIGN_MEMBERS);
    }

    addMember(name, description) {
        const newMember = {
            id: this.generateId(),
            name: name,
            description: description,
            assignments: []  // Initialize empty assignments array
        };

        // Add member to membersData
        this.membersData.members.push(newMember);
        this.updateMembersList();
        this.manager.saveToLocalStorage();
        return newMember;
    }

    editMember(memberId, name, description) {
        const member = this.membersData.members.find(m => m.id === memberId);
        if (member) {
            member.name = name;
            member.description = description;
            this.updateMembersList();
            this.manager.saveToLocalStorage();
            return true;
        }
        return false;
    }

    deleteMember(memberId) {
        const index = this.membersData.members.findIndex(m => m.id === memberId);
        if (index > -1) {
            const member = this.membersData.members[index];
            member.assignments.forEach(groupId => {
                this.removeAssignment(member.id, groupId, false);
            });
            
            this.membersData.members.splice(index, 1);
            this.updateMembersList();
            this.manager.saveToLocalStorage();
            return true;
        }
        return false;
    }

    assignMember(memberId, groupId) {
        const member = this.membersData.members.find(m => m.id === memberId);
        const group = this.manager.findGroupById(groupId, this.manager.companyData);
        
        if (!member || !group) return false;

        // Initialize assignments array if it doesn't exist
        if (!member.assignments) {
            member.assignments = [];
        }

        // Initialize members array if it doesn't exist
        if (!group.members) {
            group.members = [];
        }

        // Check if already assigned
        if (!member.assignments.includes(groupId)) {
            member.assignments.push(groupId);
            group.members.push(memberId);
            this.manager.saveToLocalStorage();
            return true;
        }
        return false;
    }

    removeAssignment(memberId, groupId, shouldConfirm = true) {
        if (shouldConfirm && !confirm('Are you sure you want to remove this member from the group?')) {
            return false;
        }

        const member = this.membersData.members.find(m => m.id === memberId);
        const group = this.manager.findGroupById(groupId, this.manager.companyData);

        if (!member || !group) return false;

        // Remove from member's assignments
        if (member.assignments) {
            const assignmentIndex = member.assignments.indexOf(groupId);
            if (assignmentIndex > -1) {
                member.assignments.splice(assignmentIndex, 1);
            }
        }

        // Remove from group's members
        if (group.members) {
            const memberIndex = group.members.indexOf(memberId);
            if (memberIndex > -1) {
                group.members.splice(memberIndex, 1);
            }
        }

        this.manager.saveToLocalStorage();
        return true;
    }

    toggleMemberAssignment(memberId, groupId) {
        const member = this.membersData.members.find(m => m.id === memberId);
        const group = this.manager.findGroupById(groupId, this.manager.companyData);

        if (!member || !group) return;

        // Initialize members array if it doesn't exist
        if (!group.members) {
            group.members = [];
        }

        const isAssigned = group.members.includes(memberId);
        
        if (isAssigned) {
            this.removeAssignment(memberId, groupId);
        } else {
            this.assignMember(memberId, groupId);
        }

        // Refresh the modal and sidebar
        this.showAssignMembersModal(group);
        if (this.manager.currentSelectedNode && this.manager.currentSelectedNode.data.id === groupId) {
            this.manager.updateSidebar(this.manager.currentSelectedNode);
        }
    }

    generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    setupEventListeners() {
        // Add member confirmation handler
        document.getElementById('confirm-add-member').addEventListener('click', () => {
            const name = document.getElementById('member-name').value.trim();
            const description = document.getElementById('member-description').value.trim();

            if (!name) {
                alert('Please enter a member name.');
                return;
            }

            this.addMember(name, description);
            
            // Clear form
            document.getElementById('member-name').value = '';
            document.getElementById('member-description').value = '';
            
            // Update sidebar if we're viewing the root node
            if (this.manager.currentSelectedNode && 
                this.manager.currentSelectedNode.data === this.manager.companyData) {
                this.manager.updateSidebar(this.manager.currentSelectedNode);
            }
            
            this.manager.modalManager.hideModal(MODAL_IDS.ADD_MEMBER);
        });

        // Edit member confirmation handler
        document.getElementById('confirm-edit-member').addEventListener('click', () => {
            const name = document.getElementById('edit-member-name').value.trim();
            const description = document.getElementById('edit-member-description').value.trim();
            const memberId = document.getElementById(MODAL_IDS.EDIT_MEMBER).dataset[DATA_ATTRIBUTES.MEMBER_ID];

            if (!name) {
                alert('Please enter a member name.');
                return;
            }

            if (this.editMember(memberId, name, description)) {
                this.manager.modalManager.hideModal(MODAL_IDS.EDIT_MEMBER);
                
                if (this.manager.currentSelectedNode) {
                    this.manager.updateSidebar(this.manager.currentSelectedNode);
                }
            }
        });

        // Delete member handler
        document.getElementById('delete-member').addEventListener('click', () => {
            const memberId = document.getElementById(MODAL_IDS.EDIT_MEMBER).dataset[DATA_ATTRIBUTES.MEMBER_ID];
            
            if (confirm('Are you sure you want to delete this member?')) {
                if (this.deleteMember(memberId)) {
                    this.manager.modalManager.hideModal(MODAL_IDS.EDIT_MEMBER);
                    
                    if (this.manager.currentSelectedNode) {
                        this.manager.updateSidebar(this.manager.currentSelectedNode);
                    }
                }
            }
        });
    }
} 