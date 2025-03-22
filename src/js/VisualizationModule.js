import { VISUALIZATION_CONSTANTS, ELEMENT_IDS } from './utils/Constants.js';

export class VisualizationModule {
    constructor(manager) {
        if (typeof d3 === 'undefined') {
            throw new Error('d3 is not loaded. Please check your script includes.');
        }
        
        this.manager = manager;
        this.colorCircle = "#1C1B1F";
        this.colorCircleLabel = "#f7f1f0";
        this.colorStrokeCircle = "#f7f1f050";
        this.colorRole = ["#122E4F", "#1F4B49"]; // Custom color theme
        this.colorRoleLabel = "#f7f1f0";
        this.colorTemplate = "#EBB8F6";
        this.colorTemplateLabel = "#f7f1f0";
        this.selectedNode = null;
        
        // D3 elements
        this.svg = null;
        this.g = null;
        this.pack = null;
        this.view = null;
        this.focus = null;

        // Create tooltip div
        this.tooltip = d3.select("body")
            .append("div")
            .attr("class", "node-tooltip")
            .style("opacity", 0);
    }

    init() {
        // Get container dimensions
        const container = document.getElementById(ELEMENT_IDS.CIRCLE_PACKING);
        console.log('Container:', container);
        if (!container) {
            console.error('Circle packing container not found');
            return;  // Safety check
        }

        // Update dimensions
        this.manager.width = container.clientWidth || 800;
        this.manager.height = container.clientHeight || 600;
        console.log('Dimensions:', this.manager.width, this.manager.height);

        // Clear any existing visualization
        d3.select(`#${ELEMENT_IDS.CIRCLE_PACKING} svg`).remove();

        // Create SVG
        this.svg = d3.select(`#${ELEMENT_IDS.CIRCLE_PACKING}`)
            .append("svg")
            .attr("width", this.manager.width)
            .attr("height", this.manager.height)
            .attr("viewBox", [-this.manager.width / 2, -this.manager.height / 2, this.manager.width, this.manager.height])
            .style("display", "block")
            .style("width", "100%")
            .style("height", "100%")
            .style("background", "transparent")
            .style("cursor", "pointer");

        this.g = this.svg.append("g");
        console.log('G element created:', this.g.node());

        // Create pack layout
        this.pack = d3.pack()
            .size([this.manager.width, this.manager.height])
            .padding(VISUALIZATION_CONSTANTS.CIRCLE_PADDING);

        // Render visualization and select root by default
        console.log('About to render visualization');
        this.renderVisualization();
        
        // Get the root node and select it
        const root = d3.hierarchy(this.manager.companyData);
        console.log('Root node:', root);
        this.manager.currentSelectedNode = root;
        this.manager.clickedNodeData = root.data;
        this.manager.sidebarManager.updateSidebar(root);
    }

    renderVisualization() {
        console.log('Starting renderVisualization');
        // Clear previous visualization
        this.g.selectAll("*").remove();

        // Create hierarchy with fixed size values
        const root = this.pack(
            d3.hierarchy(this.manager.companyData)
                .sum(() => 100)
                .sort((a, b) => {
                    if (a.depth !== b.depth) return b.depth - a.depth;
                    return a.data.name.localeCompare(b.data.name);
                })
        );
        console.log('Packed root:', root);

        // Store tooltip reference for event handlers
        const tooltip = this.tooltip;

        // Add circles with all event handlers
        const node = this.g.append("g")
            .selectAll("circle")
            .data(root)
            .join("circle")
            .attr("fill", d => this.getNodeColor(d))
            .attr("stroke", d => d.data.templateId || d.data.isRole ? "none" : this.colorStrokeCircle)
            .style("cursor", "pointer")
            .style("pointer-events", "all")
            .on("mouseover", (event, d) => {
                tooltip
                    .style("opacity", 1)
                    .html(`${d.data.name}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            })
            .on("mousemove", (event) => {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("click", (event, d) => {
                event.stopPropagation();
                this.focus !== d && (this.zoomTo(d), event.stopPropagation());
                
                // Update selected node and manager state
                this.selectedNode = d;
                this.manager.currentSelectedNode = d;
                this.manager.clickedNodeData = d.data;
                this.manager.sidebarManager.updateSidebar(d);
            });

        // Add labels
        const label = this.g.append("g")
            .style("font-family", "sans-serif")
            .style("font-weight", "bold")
            .attr("pointer-events", "none") // Make labels non-interactive
            .selectAll("text")
            .data(root.descendants())
            .join("text")
            .style("fill", d => {
                if (d.data.templateId) return this.colorTemplateLabel;
                if (d.data.isRole) return this.colorRoleLabel;
                return this.colorCircleLabel;
            })
            .style("display", "none") // Start with all labels hidden
            .style("font-size", d => Math.min(d.r / 3, 12))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(d => d.data.name);

        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                const { transform } = event;
                this.g.attr("transform", transform);
                this.g.attr("stroke-width", 1 / transform.k);
            });

        // Initialize position and zoom
        this.focus = root;
        let view;
        this.svg.on("click", (event) => {
            if (this.focus !== root) {
                this.zoomTo(root);
                event.stopPropagation();
            }
        });

        const zoomTo = (v) => {
            // Adjust the scaling factor to ensure the circle fits within the viewport
            // Add some padding (0.95) to ensure we don't zoom too close to the edges
            const k = Math.min(
                this.manager.width / v[2],
                this.manager.height / v[2]
            ) * 0.95;

            view = v;

            label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            node.attr("r", d => d.r * k);
        };

        this.zoomTo = (d) => {
            const focus0 = this.focus;
            this.focus = d;

            const transition = this.svg.transition()
                .duration(VISUALIZATION_CONSTANTS.TRANSITION_DURATION)
                .tween("zoom", () => {
                    // Adjust the target zoom to ensure the circle fits
                    const i = d3.interpolateZoom(view, [this.focus.x, this.focus.y, this.focus.r * 2.1]);
                    return t => zoomTo(i(t));
                });

            // Update label visibility
            label
                .transition(transition)
                .style("display", d => {
                    // Show label if:
                    // 1. It's a child of the focused node, OR
                    // 2. It's the focused node itself AND it's a leaf node
                    return d.parent === this.focus || (d === this.focus && !d.children) ? "inline" : "none";
                })
                .style("fill-opacity", d => {
                    return d.parent === this.focus || (d === this.focus && !d.children) ? 1 : 0;
                });
        };

        // Initial zoom with adjusted scaling
        zoomTo([root.x, root.y, root.r * 2.1]);

        // Show initial labels (root's children)
        label
            .filter(d => d.parent === root)
            .style("display", "inline")
            .style("fill-opacity", 1);
    }

    getNodeColor(node) {
        if (node.data.templateId) return this.colorTemplate;
        if (node.data.isRole) {
            // Use the node's id to consistently assign a color from the custom palette
            const colorIndex = Math.abs(node.data.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % this.colorRole.length;
            return this.colorRole[colorIndex];
        }
        if (node.children || node.data.isGroup) return this.colorCircle;
        
        // Default color if no parent or children
        return this.colorRole[0];
    }

    handleReset() {
        const root = d3.hierarchy(this.manager.companyData);
        this.currentSelectedNode = root;
        this.manager.clickedNodeData = root.data;
        
        // Trigger the same click behavior as clicking the root circle
        const event = new Event('click');
        event.stopPropagation = () => {}; // Mock stopPropagation
        this.svg.node().dispatchEvent(event);
        
        this.manager.sidebarManager.updateSidebar(root);
    }
} 