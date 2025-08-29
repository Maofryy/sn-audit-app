import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, ZoomIn, ZoomOut, RotateCcw, Loader2, AlertTriangle, Database, Users, Calendar, Globe, Network, TreePine, Zap } from "lucide-react";
import { GraphLayoutType } from "./GraphControls";
import { GraphSidebarOverlay } from "./GraphSidebarOverlay";
import { TypesLegendCard } from "./TypesLegendCard";
import { GraphSearchOverlay } from "./GraphSearchOverlay";
import { VirtualizedRenderer } from "./VirtualizedRenderer";
import { useVirtualizedPerformance } from "../hooks/useVirtualizedPerformance";
import { HierarchyMiniMap } from "./HierarchyMiniMap";
import { PerformanceMonitor } from "@/utils/performanceMonitor";
import { serviceNowService } from "@/services/serviceNowService";
import { useCMDBData } from "@/contexts/CMDBDataContext";
import { TableMetadata, FieldMetadata } from "@/types";
import { TreeLayoutFactory, TreeNodeData } from "@/utils/treeLayoutAlgorithms";

interface NodeDetails {
    table: TableMetadata;
    customFields: FieldMetadata[];
    referenceFields: FieldMetadata[];
    childTables: TableMetadata[];
    recordCount?: number;
}

export function InheritanceTreeView() {
    // Data fetching
    const { tables: cmdbTablesData, isLoading: cmdbTablesLoading } = useCMDBData();

    // State management
    const [selectedNode, setSelectedNode] = useState<TreeNodeData | null>(null);
    const [hoveredNode, setHoveredNode] = useState<TreeNodeData | null>(null);
    const [nodeDetails, setNodeDetails] = useState<NodeDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingStep, setLoadingStep] = useState<{
        step: number;
        title: string;
        description: string;
        isComplete: boolean;
    }>({ step: 0, title: "Connecting to ServiceNow", description: "Preparing to load CMDB data...", isComplete: false });
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // New state for sidebar and search
    const [layoutType, setLayoutType] = useState<GraphLayoutType>("tree");
    const [searchTerm, setSearchTerm] = useState("");
    const [visibleTableTypes, setVisibleTableTypes] = useState({
        base: true,
        extended: true,
        custom: true,
    });

    // Enhanced custom table controls
    const [customTableEmphasis, setCustomTableEmphasis] = useState<"subtle" | "moderate" | "maximum">("moderate");
    const [showCustomOnly, setShowCustomOnly] = useState(false);
    const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(new Set());

    // Performance optimization state
    const [performanceMode, setPerformanceMode] = useState<"auto" | "high" | "maximum">("auto");
    const [virtualizedNodes, setVirtualizedNodes] = useState<d3.HierarchyPointNode<TreeNodeData>[]>([]);
    const [virtualizedLinks, setVirtualizedLinks] = useState<d3.HierarchyPointLink<TreeNodeData>[]>([]);
    const { measurePerformance } = useVirtualizedPerformance();
    const performanceMonitor = useRef(new PerformanceMonitor());

    // Radial layout removed - settings no longer needed

    // Refs for DOM access
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    // Convert hierarchy to tree structure
    const convertHierarchyToTree = useCallback((node: { table: TableMetadata; children?: { table: TableMetadata; children?: unknown[]; customFieldCount?: number; totalRecordCount?: number }[]; customFieldCount?: number; totalRecordCount?: number }): TreeNodeData => {
        const tableType = node.table.table_type || (node.table.is_custom ? "custom" : node.table.name === "cmdb_ci" || node.table.name === "cmdb" ? "base" : "extended");

        return {
            name: node.table.name,
            label: node.table.label,
            type: tableType,
            table: node.table,
            customFieldCount: node.customFieldCount,
            recordCount: node.totalRecordCount,
            children: node.children?.map(convertHierarchyToTree),
        };
    }, []);

    // Load ServiceNow table hierarchy with visual step progression
    useEffect(() => {
        const loadTableHierarchy = async () => {
            let isComponentMounted = true;

            try {
                setLoading(true);
                setError(null);

                // No need for step progression - using pure CSS infinite animation

                // Start actual API call
                const hierarchy = await serviceNowService.buildTableHierarchy();

                // Only proceed if component is still mounted and we have valid data
                if (!isComponentMounted || !hierarchy?.root) {
                    return;
                }

                const treeStructure = convertHierarchyToTree(hierarchy.root);


                // Wait for visual progression to complete before showing result
                setTimeout(() => {
                    if (isComponentMounted) {
                        setTreeData(treeStructure);
                    }
                }, Math.max(0, 3000 - Date.now() + performance.now()));
            } catch (err) {
                if (isComponentMounted) {
                    setError(err instanceof Error ? err.message : "Failed to load data");
                }
            } finally {
                // Ensure loading state lasts at least 4 seconds for visual effect
                setTimeout(() => {
                    if (isComponentMounted) {
                        setLoading(false);
                    }
                }, 4000);
            }

            return () => {
                isComponentMounted = false;
            };
        };

        const cleanup = loadTableHierarchy();

        return () => {
            if (cleanup && typeof cleanup.then === "function") {
                cleanup.then((cleanupFn) => cleanupFn && cleanupFn());
            }
        };
    }, [convertHierarchyToTree]);

    // Apply visual filtering based on search and table type filters
    const applyVisualFiltering = useCallback(
        (node: TreeNodeData): TreeNodeData => {
            const processedChildren = node.children?.map((child) => applyVisualFiltering(child)) || [];

            // Check if node matches search term
            const matchesSearch = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase()) || node.label.toLowerCase().includes(searchTerm.toLowerCase());

            // Custom-only mode filtering
            if (showCustomOnly) {
                const isCustomOrHasCustomDescendant = (n: TreeNodeData): boolean => {
                    if (n.type === "custom" && matchesSearch) return true;
                    return n.children?.some((child) => isCustomOrHasCustomDescendant(child)) || false;
                };

                const shouldShow = node.type === "base" || isCustomOrHasCustomDescendant(node);

                return {
                    ...node,
                    children: processedChildren.length > 0 ? processedChildren : undefined,
                    _isFiltered: !shouldShow,
                };
            }

            // Standard filtering logic
            const hasVisibleDescendant = (n: TreeNodeData): boolean => {
                const nodeMatchesFilter = n.type === "base" || visibleTableTypes[n.type];
                const nodeMatchesSearch = !searchTerm || n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.label.toLowerCase().includes(searchTerm.toLowerCase());

                if (nodeMatchesFilter && nodeMatchesSearch) {
                    return true;
                }
                return n.children?.some((child) => hasVisibleDescendant(child)) || false;
            };

            // Determine if this node should be dimmed
            const shouldNotDim = ((node.type === "base" || visibleTableTypes[node.type]) && matchesSearch) || hasVisibleDescendant(node);

            return {
                ...node,
                children: processedChildren.length > 0 ? processedChildren : undefined,
                _isFiltered: !shouldNotDim,
            };
        },
        [visibleTableTypes, searchTerm, showCustomOnly]
    );

    // Enhanced tree layout using modular layout algorithms
    const layoutResult = useMemo(() => {

        if (!treeData) {
            return null;
        }

        const visuallyFilteredTreeData = applyVisualFiltering(treeData);
        const layout = TreeLayoutFactory.getLayout(layoutType);
        const result = layout.calculate(visuallyFilteredTreeData, dimensions, performanceMode);
        

        return result;
    }, [treeData, dimensions, layoutType, applyVisualFiltering, performanceMode]);

    // Control handlers
    const handleZoomIn = () => {
        if (zoomRef.current && svgRef.current) {
            d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
        }
    };

    const handleZoomOut = () => {
        if (zoomRef.current && svgRef.current) {
            d3.select(svgRef.current)
                .transition()
                .duration(300)
                .call(zoomRef.current.scaleBy, 1 / 1.5);
        }
    };

    const handleResetView = () => {
        if (zoomRef.current && svgRef.current && layoutResult) {
            // Find the root node (cmdb_ci) position for reset
            const rootNode = layoutResult.nodes.find(node => node.data.name === 'cmdb_ci' || node.data.name === 'cmdb');
            
            if (rootNode) {
                // Center on the root node with appropriate scale
                let initialScale = Math.min(dimensions.width / layoutResult.bounds.width, dimensions.height / layoutResult.bounds.height, 1);
                initialScale = Math.min(initialScale * 0.8, 1); // Conservative scale with padding
                
                // Calculate position to center the root node in the viewport
                const rootX = rootNode.y + layoutResult.margin.left;
                const rootY = rootNode.x + layoutResult.margin.top;
                
                // Center the root node in the middle of the container
                const centerX = dimensions.width / 2 - rootX * initialScale;
                const centerY = dimensions.height / 2 - rootY * initialScale;
                
                const resetTransform = d3.zoomIdentity.translate(centerX, centerY).scale(initialScale);
                
                d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, resetTransform);
            } else {
                // Fallback to bounds-based centering if root node not found
                let initialScale = Math.min(dimensions.width / layoutResult.bounds.width, dimensions.height / layoutResult.bounds.height, 1);
                initialScale = initialScale * 0.9;
                
                const centerX = (dimensions.width - layoutResult.bounds.width * initialScale) / 2;
                const centerY = (dimensions.height - layoutResult.bounds.height * initialScale) / 2;
                
                const resetTransform = d3.zoomIdentity.translate(centerX, centerY).scale(initialScale);
                
                d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, resetTransform);
            }
        }
        setSelectedNode(null);
        setHoveredNode(null);
        // The useEffect will automatically reset to default highlighting when selectedNode becomes null
    };

    // Setup D3 zoom behavior ONLY after all data is loaded
    useEffect(() => {

        // Wait for everything to be ready including loading state
        if (!svgRef.current || !treeData || !layoutResult || dimensions.width === 0 || dimensions.height === 0 || loading) {
            return;
        }


        const svg = d3.select(svgRef.current);
        
        // Clear any existing zoom behavior first
        svg.on(".zoom", null);

        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 10]) // Standard zoom range
            .on("zoom", (event) => {
                setTransform({
                    x: event.transform.x,
                    y: event.transform.y,
                    k: event.transform.k,
                });
            });


        // Find the root node (cmdb_ci) position for initial centering
        const rootNode = layoutResult.nodes.find(node => node.data.name === 'cmdb_ci' || node.data.name === 'cmdb');
        
        let initialTransform;
        if (rootNode) {
            // Center on the root node with appropriate scale
            let initialScale = Math.min(dimensions.width / layoutResult.bounds.width, dimensions.height / layoutResult.bounds.height, 1);
            initialScale = Math.min(initialScale * 0.8, 1); // Conservative scale with padding
            
            // Calculate position to center the root node in the viewport
            const rootX = rootNode.y + layoutResult.margin.left;
            const rootY = rootNode.x + layoutResult.margin.top;
            
            // Center the root node in the middle of the container
            const centerX = dimensions.width / 2 - rootX * initialScale;
            const centerY = dimensions.height / 2 - rootY * initialScale;
            
            initialTransform = d3.zoomIdentity.translate(centerX, centerY).scale(initialScale);
            
        } else {
            // Fallback to bounds-based centering if root node not found
            let initialScale = Math.min(dimensions.width / layoutResult.bounds.width, dimensions.height / layoutResult.bounds.height, 1);
            initialScale = initialScale * 0.9;
            
            const centerX = (dimensions.width - layoutResult.bounds.width * initialScale) / 2;
            const centerY = (dimensions.height - layoutResult.bounds.height * initialScale) / 2;
            
            initialTransform = d3.zoomIdentity.translate(centerX, centerY).scale(initialScale);
            
        }

        // Store zoom reference immediately
        zoomRef.current = zoom;
        
        // Set the initial transform state without triggering zoom behavior
        setTransform({
            x: initialTransform.x,
            y: initialTransform.y,
            k: initialTransform.k,
        });

        // Apply zoom behavior and set initial transform
        try {
            svg.call(zoom.transform, initialTransform).call(zoom);
            
            // Test if zoom is working by checking if mouse events are bound
            setTimeout(() => {
                const svgNode = svg.node() as SVGSVGElement;
                if (svgNode) {
                }
            }, 100);
            
        } catch (error) {
        }

        return () => {
            svg.on(".zoom", null);
        };
    }, [treeData, layoutResult, dimensions, loading]);

    // Resize handler with improved initial sizing
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        let rafId: number;

        const handleResize = () => {
            clearTimeout(timeoutId);
            cancelAnimationFrame(rafId);
            
            // Use RAF to ensure DOM is ready
            rafId = requestAnimationFrame(() => {
                timeoutId = setTimeout(() => {
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        const newWidth = Math.max(400, rect.width || 800);
                        const newHeight = Math.max(400, rect.height || 600);

                        setDimensions((prev) => {
                            if (Math.abs(prev.width - newWidth) > 10 || Math.abs(prev.height - newHeight) > 10) {
                                return { width: newWidth, height: newHeight };
                            }
                            return prev;
                        });
                    }
                }, 150);
            });
        };

        // Initial sizing with delay to ensure DOM is ready
        setTimeout(handleResize, 100);
        window.addEventListener("resize", handleResize);

        return () => {
            clearTimeout(timeoutId);
            cancelAnimationFrame(rafId);
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    // Ensure dimensions are updated when layout result is available
    useEffect(() => {
        if (layoutResult && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const newWidth = Math.max(400, rect.width);
            const newHeight = Math.max(400, rect.height);

            setDimensions((prev) => {
                if (Math.abs(prev.width - newWidth) > 10 || Math.abs(prev.height - newHeight) > 10) {
                    return { width: newWidth, height: newHeight };
                }
                return prev;
            });
        }
    }, [layoutResult]);

    // Enhanced node styling with orange custom table emphasis and LOD
    const getNodeStyle = (nodeType: string, isSelected: boolean, isHovered: boolean, isFiltered: boolean, lodLevel: "full" | "simplified" | "minimal" = "full") => {
        // Base styles - standard sizing
        const baseRadius = 6;
        const baseStrokeWidth = 2;

        const styles = {
            base: {
                fill: "#1e40af",
                stroke: "#1e293b",
                radius: baseRadius,
                strokeWidth: baseStrokeWidth,
            },
            extended: {
                fill: "#059669",
                stroke: "#1e293b",
                radius: baseRadius + 1,
                strokeWidth: baseStrokeWidth,
            },
            custom: {
                fill: "#ea580c",
                stroke: "#9a3412",
                radius: baseRadius + 4,
                strokeWidth: baseStrokeWidth + 1,
            },
        };

        let style = styles[nodeType as keyof typeof styles] || styles.extended;

        // Level of detail adjustments
        if (lodLevel === "simplified") {
            style = {
                ...style,
                radius: Math.max(4, style.radius * 0.8),
                strokeWidth: Math.max(1, style.strokeWidth - 1),
            };
        } else if (lodLevel === "minimal") {
            style = {
                ...style,
                radius: Math.max(3, style.radius * 0.6),
                strokeWidth: 1,
            };
        }

        // Performance mode adjustments
        if (layoutResult?.isHighPerformance) {
            style = {
                ...style,
                radius: Math.max(3, style.radius * 0.8),
                strokeWidth: Math.max(1, style.strokeWidth),
            };
        }

        if (isFiltered) {
            style = {
                ...style,
                fill: "#d1d5db",
                stroke: "#9ca3af",
            };
        }

        if (isSelected) {
            style = {
                ...style,
                radius: style.radius + 2,
                strokeWidth: style.strokeWidth + 1,
            };
        } else if (isHovered) {
            style = {
                ...style,
                radius: style.radius + 1,
            };
        }

        return style;
    };

    // Handle virtualized rendering updates
    const handleVirtualizedRender = useCallback((nodes: d3.HierarchyPointNode<TreeNodeData>[], links: d3.HierarchyPointLink<TreeNodeData>[]) => {
        setVirtualizedNodes(nodes);
        setVirtualizedLinks(links);
    }, []);

    // Auto-detect performance mode based on node count
    useEffect(() => {
        if (!layoutResult) return;

        const nodeCount = layoutResult.nodeCount || 0;
        if (performanceMode === "auto") {
            if (nodeCount > 1000) {
                setPerformanceMode("maximum");
            } else if (nodeCount > 500) {
                setPerformanceMode("high");
            }
        }
    }, [layoutResult, performanceMode]);

    // Render node with LOD and virtualization support
    const renderNode = (d3Node: d3.HierarchyPointNode<TreeNodeData>, lodLevel: "full" | "simplified" | "minimal" = "full") => {
        if (!layoutResult) return null;

        const node = d3Node.data;
        const isSelected = selectedNode?.name === node.name;
        const isHovered = hoveredNode?.name === node.name;
        const isFiltered = node._isFiltered;
        const isCustom = node.type === "custom";
        const { margin } = layoutResult;
        const nodeDepth = d3Node.depth;

        // Performance measurements
        const perf = measurePerformance();
        performanceMonitor.current.startRender();

        const nodeStyle = getNodeStyle(node.type, isSelected, isHovered, isFiltered, lodLevel);
        const textColor = isFiltered ? "#9ca3af" : "#374151";
        const opacity = isFiltered ? 0.5 : 1;

        // Apply custom table emphasis scaling
        if (isCustom && !isFiltered) {
            const emphasisScale = {
                subtle: 1.2,
                moderate: 1.67,
                maximum: 2.0,
            }[customTableEmphasis];

            nodeStyle.radius = Math.round(nodeStyle.radius * emphasisScale);
        }

        // Simplified rendering for performance
        const shouldShowLabel = lodLevel === "full" || (lodLevel === "simplified" && isCustom);
        const shouldShowGlow = lodLevel === "full" && isCustom && !isFiltered;
        const shouldShowIndicator = lodLevel !== "minimal" && isCustom && !isFiltered;

        // Standard tree layout positioning
        const nodeX = d3Node.y + margin.left;
        const nodeY = d3Node.x + margin.top;
        const labelX = nodeX + nodeStyle.radius + 10; // Position to center-right of the node
        const labelY = nodeY + 4; // Center vertically with the node
        const indicatorX = nodeX + nodeStyle.radius + 5;
        const indicatorY = nodeY - nodeStyle.radius;

        return (
            <g key={node.name} opacity={opacity} className={isCustom ? "custom-table-node" : ""}>
                {/* Glow effect for custom tables */}
                {isCustom && !isFiltered && (
                    <circle
                        cx={nodeX}
                        cy={nodeY}
                        r={nodeStyle.radius + 4}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2"
                        opacity="0.6"
                        style={{
                            filter: "drop-shadow(0 0 8px #f97316)",
                        }}
                    />
                )}

                {/* Main node - diamond shape for custom tables */}
                {isCustom && !isFiltered ? (
                    <polygon
                        points={`${nodeX - nodeStyle.radius},${nodeY} ${nodeX},${nodeY - nodeStyle.radius} ${nodeX + nodeStyle.radius},${nodeY} ${nodeX},${nodeY + nodeStyle.radius}`}
                        fill={nodeStyle.fill}
                        stroke={nodeStyle.stroke}
                        strokeWidth={nodeStyle.strokeWidth}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleNodeClick(node)}
                        onMouseEnter={() => setHoveredNode(node)}
                    />
                ) : (
                    <circle
                        cx={nodeX}
                        cy={nodeY}
                        r={nodeStyle.radius}
                        fill={nodeStyle.fill}
                        stroke={nodeStyle.stroke}
                        strokeWidth={nodeStyle.strokeWidth}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleNodeClick(node)}
                        onMouseEnter={() => setHoveredNode(node)}
                    />
                )}

                {/* Standard text labels with background */}
                {/* Background for text readability */}
                <text
                    x={labelX}
                    y={labelY}
                    textAnchor="start"
                    fontSize={isCustom ? "15" : "14"}
                    fill="white"
                    stroke="white"
                    strokeWidth="3"
                    fontWeight={isCustom ? "bold" : "normal"}
                    style={{
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                >
                    {node.label}
                </text>
                {/* Foreground text */}
                <text
                    x={labelX}
                    y={labelY}
                    textAnchor="start"
                    fontSize={isCustom ? "15" : "14"}
                    fill={textColor}
                    fontWeight={isCustom ? "bold" : "normal"}
                    style={{
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                >
                    {node.label}
                </text>

                {/* Custom table indicator */}
                {isCustom && !isFiltered && (
                    <text x={indicatorX} y={indicatorY} fontSize="10" fill="#ea580c" fontWeight="bold" style={{ pointerEvents: "none", userSelect: "none" }}>
                        ★
                    </text>
                )}
            </g>
        );
    };

    // Get path from node to root for highlighting
    const getPathToRoot = useCallback(
        (nodeName: string): string[] => {
            const path: string[] = [];
            const findPath = (node: TreeNodeData): boolean => {
                if (node.name === nodeName) {
                    path.push(node.name);
                    return true;
                }
                if (node.children) {
                    for (const child of node.children) {
                        if (findPath(child)) {
                            path.push(node.name);
                            return true;
                        }
                    }
                }
                return false;
            };

            if (treeData) {
                findPath(treeData);
            }
            return path.reverse();
        },
        [treeData]
    );

    // Get all paths to custom tables for default highlighting
    const getAllCustomTablePaths = useCallback((): Set<string> => {
        const allCustomPaths = new Set<string>();

        const findCustomTables = (node: TreeNodeData): void => {
            if (node.type === "custom") {
                const pathNodes = getPathToRoot(node.name);
                pathNodes.forEach((pathNode) => allCustomPaths.add(pathNode));
            }
            if (node.children) {
                node.children.forEach(findCustomTables);
            }
        };

        if (treeData) {
            findCustomTables(treeData);
        }

        return allCustomPaths;
    }, [treeData, getPathToRoot]);

    // Set up default highlighting for all custom table paths
    useEffect(() => {
        if (treeData && !selectedNode) {
            const defaultPaths = getAllCustomTablePaths();
            setHighlightedPaths(defaultPaths);
        }
    }, [treeData, selectedNode, getAllCustomTablePaths]);

    // Handle node selection with path highlighting
    const handleNodeClick = useCallback(
        (node: TreeNodeData) => {
            const wasSelected = selectedNode?.name === node.name;
            setSelectedNode(wasSelected ? null : node);

            if (!wasSelected && node.type === "custom") {
                // Highlight path to specific custom table
                const pathNodes = getPathToRoot(node.name);
                setHighlightedPaths(new Set(pathNodes));
            } else if (wasSelected) {
                // Return to showing all custom table paths when deselecting
                const allCustomPaths = getAllCustomTablePaths();
                setHighlightedPaths(allCustomPaths);
            }
        },
        [selectedNode, getPathToRoot, getAllCustomTablePaths]
    );

    // Render link with path highlighting - adaptive for different layout types
    const renderLink = (d3Link: d3.HierarchyPointLink<TreeNodeData>) => {
        if (!layoutResult) return null;

        const { margin } = layoutResult;
        const isTargetFiltered = d3Link.target.data._isFiltered;
        const isInHighlightedPath = highlightedPaths.has(d3Link.source.data.name) && highlightedPaths.has(d3Link.target.data.name);

        let linkOpacity = isTargetFiltered ? 0.3 : 1;
        let strokeColor = isTargetFiltered ? "#e2e8f0" : "#cbd5e1";
        let strokeWidth = "2";
        let className = "";

        if (isInHighlightedPath && !isTargetFiltered) {
            strokeColor = "#f97316";
            strokeWidth = "4";
            linkOpacity = 1;
            className = "custom-path-highlight";
        }

        // Standard tree layout curved paths
        const pathD = `M${d3Link.source.y + margin.left},${d3Link.source.x + margin.top}
                   C${(d3Link.source.y + d3Link.target.y) / 2 + margin.left},${d3Link.source.x + margin.top}
                    ${(d3Link.source.y + d3Link.target.y) / 2 + margin.left},${d3Link.target.x + margin.top}
                    ${d3Link.target.y + margin.left},${d3Link.target.x + margin.top}`;

        return <path key={`${d3Link.source.data.name}-${d3Link.target.data.name}`} className={className} d={pathD} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} opacity={linkOpacity} />;
    };

    if (loading) {
        return (
            <div className="w-full space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Main loading visualization */}
                    <div className="lg:col-span-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">CMDB Table Hierarchy</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full rounded-lg bg-slate-50/50 relative flex items-center justify-center" style={{ height: "600px" }}>
                                    {/* Cinematic Loading Animation */}
                                    <div className="text-center w-full">
                                        {/* Infinite Cycling Text Animation */}
                                        <div className="h-12 flex items-center justify-center overflow-hidden relative w-full ">
                                            <div className="text-lg font-medium text-gray-400 whitespace-nowrap animate-cycling-text relative w-80">
                                                <span className="step-text">Connecting to ServiceNow</span>
                                                <span className="step-text">Fetching CMDB Tables</span>
                                                <span className="step-text">Building Hierarchy</span>
                                                <span className="step-text">Preparing Visualization</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CSS for infinite cycling text animation */}
                                    <style>{`
                        .animate-cycling-text {
                          position: relative;
                          height: 1.5rem;
                        }
                        
                        .step-text {
                          position: absolute;
                          top: 0;
                          left: 40%;
                          transform: translateX(-40%);
                          opacity: 0;
                          animation: textSlide 8s infinite ease-in-out;
                        }
                        
                        .step-text:nth-child(1) { 
                          animation-delay: 0s; 
                        }
                        .step-text:nth-child(2) { 
                          animation-delay: 2s; 
                        }
                        .step-text:nth-child(3) { 
                          animation-delay: 4s; 
                        }
                        .step-text:nth-child(4) { 
                          animation-delay: 6s; 
                        }
                        
                        @keyframes textSlide {
                          0% {
                            opacity: 0;
                            transform: translateX(100%);
                          }
                          8.33% {
                            opacity: 1;
                            transform: translateX(-50%);
                          }
                          16.67% {
                            opacity: 1;
                            transform: translateX(-50%);
                          }
                          25% {
                            opacity: 0;
                            transform: translateX(-150%);
                          }
                          100% {
                            opacity: 0;
                            transform: translateX(-150%);
                          }
                        }
                      `}</style>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Skeleton loading for details panel */}
                    <div className="lg:col-span-1">
                        <Card className="w-full">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Database className="h-5 w-5" />
                                    <Skeleton className="h-5 w-24" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Skeleton placeholder for table details */}
                                <div className="space-y-4">
                                    <div className="p-3 rounded-lg bg-slate-50 space-y-3">
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-20" />
                                            <Skeleton className="h-4 w-32" />
                                        </div>
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-24" />
                                            <Skeleton className="h-4 w-28" />
                                        </div>
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-6 w-20" />
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                                        <Skeleton className="h-3 w-16" />
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="w-3 h-3 rounded-full" />
                                                <Skeleton className="h-3 w-32" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="w-3 h-3 rounded-full" />
                                                <Skeleton className="h-3 w-36" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="w-3 h-3" />
                                                <Skeleton className="h-3 w-28" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    if (error || (!loading && !treeData) || (!loading && !layoutResult)) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error || "No table hierarchy data available."}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="w-full space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Tree Visualization - now takes 3/4 instead of 2/3 */}
                <div className="lg:col-span-3">
                    <Card className="w-full">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">CMDB Table Hierarchy</CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Root: {treeData.name} | Tables: {layoutResult.nodes.filter((n) => !n.data._isFiltered).length}/{layoutResult.nodes.length}
                                        {layoutResult.isHighPerformance && <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">⚡ Performance Mode</span>}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div ref={containerRef} className="w-full border rounded-lg bg-slate-50/50 relative" style={{ height: "600px" }}>
                                {/* Sidebar Overlay Controls - positioned over D3.js canvas */}
                                <GraphSidebarOverlay
                                    onZoomIn={handleZoomIn}
                                    onZoomOut={handleZoomOut}
                                    onResetView={handleResetView}
                                    visibleTableTypes={visibleTableTypes}
                                    onTableTypeToggle={(type) => {
                                        setVisibleTableTypes((prev) => ({
                                            ...prev,
                                            [type]: !prev[type],
                                        }));
                                    }}
                                    showCustomOnly={showCustomOnly}
                                    onCustomOnlyToggle={() => setShowCustomOnly(!showCustomOnly)}
                                    customTableCount={layoutResult?.nodes.filter((n) => n.data.type === "custom" && !n.data._isFiltered).length || 0}
                                />

                                {/* Search Overlay */}
                                <GraphSearchOverlay
                                    searchTerm={searchTerm}
                                    onSearchChange={setSearchTerm}
                                    nodeCount={layoutResult.nodes.length}
                                    filteredCount={layoutResult.nodes.filter((n) => !n.data._isFiltered).length}
                                />

                                {/* Hierarchy Mini-Map */}
                                <HierarchyMiniMap
                                    treeData={treeData}
                                    selectedNode={selectedNode}
                                    onNodeClick={handleNodeClick}
                                    transform={transform}
                                    bounds={layoutResult.bounds}
                                    canvasDimensions={dimensions}
                                    layoutType={layoutType}
                                />

                                {/* Virtualized Renderer for Performance */}
                                {layoutResult.isHighPerformance && (
                                    <VirtualizedRenderer
                                        nodes={layoutResult.nodes}
                                        links={layoutResult.links}
                                        transform={transform}
                                        bounds={layoutResult.bounds}
                                        customTableEmphasis={customTableEmphasis}
                                        onRender={handleVirtualizedRender}
                                    />
                                )}

                                <svg
                                    ref={svgRef}
                                    width={dimensions.width}
                                    height={dimensions.height}
                                    style={{ 
                                        width: '100%', 
                                        height: '100%',
                                        maxWidth: '100%', 
                                        maxHeight: '100%'
                                    }}
                                    className="cursor-grab border border-gray-200 rounded"
                                >
                                    <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
                                        {/* Performance-optimized rendering */}
                                        {layoutResult.isHighPerformance ? (
                                            // Virtualized rendering for high node counts
                                            <>
                                                {virtualizedLinks.map((link) => renderLink(link.originalLink))}
                                                {virtualizedNodes.map((node) => {
                                                    const lodLevel = node.lodLevel || "full";
                                                    return renderNode(node.originalNode, lodLevel);
                                                })}
                                            </>
                                        ) : (
                                            // Standard rendering for normal node counts
                                            <>
                                                {layoutResult.links.map(renderLink)}
                                                {layoutResult.nodes.map((node) => renderNode(node))}
                                            </>
                                        )}
                                    </g>
                                </svg>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Details Panel - keeping original */}
                <div className="lg:col-span-1">
                    <Card className="w-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                {hoveredNode ? "Table Details" : selectedNode ? "Selected Table" : "Hover to Explore"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {hoveredNode || selectedNode ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className={`p-3 rounded-lg space-y-2 ${(hoveredNode || selectedNode)?.type === "custom" ? "custom-table-legend" : "bg-slate-50"}`}>
                                            <div>
                                                <span className="text-xs text-muted-foreground uppercase tracking-wide">System Name</span>
                                                <p className="font-mono text-sm">{(hoveredNode || selectedNode)?.name}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Display Label</span>
                                                <p className="text-sm">{(hoveredNode || selectedNode)?.label}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground uppercase tracking-wide">Type</span>
                                                <Badge variant="outline" className={(hoveredNode || selectedNode)?.type === "custom" ? "border-orange-500 text-orange-700" : ""}>
                                                    <div className="flex items-center gap-1">
                                                        {(hoveredNode || selectedNode)?.type === "custom" && <span className="custom-table-legend-icon">♦</span>}
                                                        {(hoveredNode || selectedNode)?.type?.toUpperCase()}
                                                    </div>
                                                </Badge>
                                            </div>

                                            {/* Custom table metrics */}
                                            {(hoveredNode || selectedNode)?.type === "custom" && (
                                                <div className="border-t pt-2 mt-2">
                                                    <div className="text-xs text-orange-700 font-medium mb-1">Custom Table Metrics</div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-muted-foreground">Custom Fields:</span>
                                                            <p className="font-medium">{(hoveredNode || selectedNode)?.customFieldCount || 0}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Records:</span>
                                                            <p className="font-medium">{(hoveredNode || selectedNode)?.recordCount || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Legend for all table types */}
                                        <div className="bg-slate-50 p-3 rounded-lg">
                                            <div className="text-xs font-medium text-gray-700 mb-2">Legend</div>
                                            <div className="space-y-1 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                    <span>Base Tables (Foundation)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                    <span>Extended Tables (Standard)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 bg-orange-500 transform rotate-45"></div>
                                                    <span className="font-semibold">
                                                        Custom Tables ({layoutResult?.nodes.filter((n) => n.data.type === "custom" && !n.data._isFiltered).length || 0})
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                        <span className="text-sm">ServiceNow Integration Active</span>
                                    </div>
                                    <div className="text-sm text-center text-muted-foreground italic">Hover over any table to see details</div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Types Legend Card */}
            <div className="flex justify-center">
                <TypesLegendCard
                    visibleTableTypes={visibleTableTypes}
                    onTableTypeToggle={(type) => {
                        setVisibleTableTypes((prev) => ({
                            ...prev,
                            [type]: !prev[type],
                        }));
                    }}
                    customTableCount={layoutResult?.nodes.filter((n) => n.data.type === "custom" && !n.data._isFiltered).length || 0}
                    showCustomOnly={showCustomOnly}
                    onCustomOnlyToggle={() => setShowCustomOnly(!showCustomOnly)}
                />
            </div>
        </div>
    );
}
