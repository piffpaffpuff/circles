import { VISUALIZATION_CONSTANTS, ELEMENT_IDS } from './utils/Constants.js';

export class VisualizationModule {
    constructor(manager) {
        if (typeof d3 === 'undefined') {
            throw new Error('d3 is not loaded. Please check your script includes.');
        }
        
        this.manager = manager;
        this.colorTemplate = "#053255";
        this.colorLabel = "#ffffff";
        this.colorLabelCircle = "#ffffff";
        this.colorCircle = "rgba(179, 176, 175, 0.3)";
        this.colorPalette = ["#014540"];
        
        // D3 elements
        this.svg = null;
        this.g = null;
        this.pack = null;
        this.view = null;

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
            .style("pointer-events", "all");
        console.log('SVG created:', this.svg.node());

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
        const nodes = this.g.selectAll("circle")
            .data(root.descendants())
            .join("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", d => d.r)
            .attr("fill", d => this.getNodeColor(d))
            .attr("stroke", "none")
            .attr("stroke-width", "2px")
            .style("cursor", "pointer")
            .style("pointer-events", "all")
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget)
                    .attr("stroke", "rgba(255, 255, 255, 0.5)")
                    .attr("stroke-width", "2px");

                tooltip
                    .style("opacity", 1)
                    .html(`${d.data.name}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", (event, d) => {
                d3.select(event.currentTarget)
                    .attr("stroke", "none")
                    .attr("stroke-width", "0px");

                tooltip.style("opacity", 0);
            })
            .on("mousemove", (event, d) => {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("click", (event, d) => {
                event.stopPropagation();
                this.manager.currentSelectedNode = d;
                this.manager.clickedNodeData = d.data;
                this.manager.sidebarManager.updateSidebar(d);
                this.zoomTo(d);
            });

        // Add labels
        this.g.selectAll("text")
            .data(root.descendants())
            .join("text")
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", d => Math.min(d.r / 3, 12))
            .text(d => d.data.name)
            .style("pointer-events", "none")
            .style("fill", d => d.children ? this.colorLabelCircle : this.colorLabel)
            .style("font-weight", "bold");

        // Initial zoom to root
        this.view = root;
        this.zoomTo(root);
    }

    zoomTo(d) {
        const focus0 = this.view;
        const focus1 = d;

        this.view = focus1;
        
        const k = Math.min(
            this.manager.width / (focus1.r * 3),
            this.manager.height / (focus1.r * 3)
        );
        const x = this.manager.width / 2 - focus1.x * k;
        const y = this.manager.height / 2 - focus1.y * k;
        
        this.g.transition()
            .duration(VISUALIZATION_CONSTANTS.TRANSITION_DURATION)
            .attr("transform", `translate(${x},${y}) scale(${k})`);

        this.g.selectAll("text")
            .transition()
            .duration(VISUALIZATION_CONSTANTS.TRANSITION_DURATION)
            .style("opacity", node => {
                if (node.depth === 0) return 0;
                // Show label if it's either:
                // 1. A child of the focused node
                // 2. The focused node itself, but only if it's a leaf node (no children)
                return (node.parent === focus1 || (node === focus1 && !node.children)) ? 1 : 0;
            })
            .attr("font-size", node => {
                return Math.min(node.r / 3 * k, 12) + "px";
            });
    }

    getNodeColor(node) {
        if (node.data.templateId) return this.colorTemplate;
        if (node.data.isRole) return this.colorPalette[0];
        if (node.children || node.data.isGroup) return this.colorCircle;
        
        // Only try to get color from parent's children if parent exists
        if (node.parent && node.parent.children) {
            const colorIndex = node.depth > 1 
                ? node.parent.children.indexOf(node) 
                : node.parent.children.indexOf(node);
            
            return this.colorPalette[colorIndex % this.colorPalette.length];
        }
        
        // Default color if no parent or children
        return this.colorPalette[0];
    }
} 