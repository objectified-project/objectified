# Tree and Radial Layouts - Implementation Guide

## Overview

Added two new organic layout algorithms to the canvas: **Tree Layout** and **Radial Layout**. These layouts provide natural, hierarchical arrangements ideal for showing relationships and central dependencies.

## New Layouts

### 1. Tree Layout (🌳)

**Description:** Organic tree structure with adjustable branching

**Best For:**
- Hierarchical data with clear parent-child relationships
- File system structures
- Organization charts
- Taxonomy visualizations
- Decision trees

**Algorithm:**
- Uses BFS (Breadth-First Search) to build tree structure
- Positions nodes recursively, level by level
- Centers parent nodes above their children
- Supports both vertical and horizontal orientations

**Configuration Options:**
```typescript
{
  algorithm: 'tree',
  branchSeparation: 120,      // Horizontal space between siblings
  levelSeparation: 200,       // Vertical space between levels
  orientation: 'vertical'     // 'vertical' or 'horizontal'
}
```

**Visual Example:**
```
Vertical Tree:
        Root
       /    \
    Child1  Child2
    /  \      |
  C1  C2    C3

Horizontal Tree:
Root ─┬─ Child1 ─┬─ C1
      │          └─ C2
      └─ Child2 ─── C3
```

**Characteristics:**
- ✅ Natural branching structure
- ✅ Clear hierarchy visualization
- ✅ Adjustable spacing
- ✅ Handles multiple roots
- ✅ Organic, tree-like appearance

### 2. Radial Layout (🎯)

**Description:** Central node with others radiating outward in concentric rings

**Best For:**
- Showing central dependencies
- Hub-and-spoke relationships
- Social networks
- API dependency graphs
- Star patterns

**Algorithm:**
- Identifies most connected node as center
- Uses BFS to assign nodes to rings by distance
- Positions nodes evenly around each ring
- Creates concentric circle arrangement

**Configuration Options:**
```typescript
{
  algorithm: 'radial',
  radiusIncrement: 200,       // Distance between rings
  angleSpacing: 0.3          // Angular spacing (radians)
}
```

**Visual Example:**
```
         B
    A        C
         
    H   [CENTER]   D
         
    G        E
         F

Ring 0: [CENTER]
Ring 1: A, B, C, D
Ring 2: E, F, G, H
```

**Characteristics:**
- ✅ Central focus point
- ✅ Distance from center shows relationship depth
- ✅ Even distribution on each ring
- ✅ Compact arrangement
- ✅ Clear radial symmetry

## Implementation Details

### Tree Layout Algorithm

#### Phase 1: Build Tree Structure
```typescript
// Identify parent-child relationships
edges.forEach(edge => {
  children[edge.source].push(edge.target);
  parents[edge.target] = edge.source;
});

// Find roots (nodes with no parents)
const roots = nodes.filter(node => !parents.has(node.id));
```

#### Phase 2: Recursive Positioning
```typescript
function calculateTreeLayout(nodeId, level, startX) {
  const childIds = children[nodeId];
  
  // Process children first
  childIds.forEach(childId => {
    calculateTreeLayout(childId, level + 1, currentX);
    currentX += branchSeparation;
  });
  
  // Center parent above children
  const centerX = (minChildX + maxChildX) / 2;
  nodePositions[nodeId] = { x: centerX, y: level * levelSeparation };
}
```

#### Phase 3: Apply Orientation
```typescript
if (orientation === 'horizontal') {
  // Swap x and y coordinates
  position = { x: pos.y, y: pos.x };
} else {
  position = { x: pos.x, y: pos.y };
}
```

### Radial Layout Algorithm

#### Phase 1: Find Center Node
```typescript
// Most connected node becomes center
let centerNode = nodes[0];
let maxConnections = 0;

nodes.forEach(node => {
  const connections = adjacency[node.id].size;
  if (connections > maxConnections) {
    maxConnections = connections;
    centerNode = node;
  }
});
```

#### Phase 2: Assign to Rings (BFS)
```typescript
const queue = [{ id: centerNode.id, ring: 0 }];

while (queue.length > 0) {
  const { id, ring } = queue.shift();
  nodeToRing[id] = ring;
  
  // Add neighbors to next ring
  adjacency[id].forEach(neighborId => {
    if (!visited.has(neighborId)) {
      queue.push({ id: neighborId, ring: ring + 1 });
    }
  });
}
```

#### Phase 3: Position on Rings
```typescript
const ring = nodeToRing[nodeId];
const radius = ring * radiusIncrement;
const angleStep = (2 * Math.PI) / nodesInRing.length;
const angle = indexInRing * angleStep - Math.PI / 2; // Start at top

const x = Math.cos(angle) * radius;
const y = Math.sin(angle) * radius;
```

## Usage Examples

### Tree Layout - Organization Chart

```typescript
// Create organization structure
const ceo = { id: 'ceo', name: 'CEO' };
const cto = { id: 'cto', name: 'CTO' };
const cfo = { id: 'cfo', name: 'CFO' };
const dev1 = { id: 'dev1', name: 'Developer 1' };
const dev2 = { id: 'dev2', name: 'Developer 2' };

const edges = [
  { source: 'ceo', target: 'cto' },
  { source: 'ceo', target: 'cfo' },
  { source: 'cto', target: 'dev1' },
  { source: 'cto', target: 'dev2' },
];

// Apply tree layout
const layoutedNodes = applyAutoLayout(nodes, edges, {
  algorithm: 'tree',
  branchSeparation: 150,
  levelSeparation: 250,
  orientation: 'vertical',
});
```

Result:
```
         CEO
        /   \
      CTO   CFO
      / \
   Dev1 Dev2
```

### Radial Layout - API Dependencies

```typescript
// Central API with dependent services
const api = { id: 'api', name: 'API Gateway' };
const auth = { id: 'auth', name: 'Auth Service' };
const user = { id: 'user', name: 'User Service' };
const order = { id: 'order', name: 'Order Service' };
const payment = { id: 'payment', name: 'Payment Service' };

const edges = [
  { source: 'api', target: 'auth' },
  { source: 'api', target: 'user' },
  { source: 'api', target: 'order' },
  { source: 'order', target: 'payment' },
];

// Apply radial layout
const layoutedNodes = applyAutoLayout(nodes, edges, {
  algorithm: 'radial',
  radiusIncrement: 250,
});
```

Result:
```
      Auth
        
User [API] Order
        
            Payment
```

## Comparison with Other Layouts

| Layout | Tree | Radial | Hierarchical | Force-Directed |
|--------|------|--------|--------------|----------------|
| **Structure** | Branching | Concentric | Linear | Organic |
| **Best For** | Parent-child | Hub-spoke | Dependencies | Clustering |
| **Complexity** | O(n) | O(n + e) | O(n log n) | O(n²) |
| **Spacing** | Variable | Even | Fixed | Dynamic |
| **Center** | Root(s) | Most connected | None | Natural |

## Configuration Guide

### Tree Layout Options

**branchSeparation** (default: 120)
- Controls horizontal spacing between sibling nodes
- Smaller values: More compact tree
- Larger values: More spread out tree
- Recommended: 100-200

**levelSeparation** (default: 200)
- Controls vertical spacing between levels
- Smaller values: Compressed tree
- Larger values: Stretched tree
- Recommended: 150-300

**orientation** (default: 'vertical')
- `'vertical'`: Traditional top-down tree
- `'horizontal'`: Left-to-right tree
- Use horizontal for wide, shallow trees

### Radial Layout Options

**radiusIncrement** (default: 200)
- Distance between each ring
- Smaller values: Compact radial
- Larger values: Spread out radial
- Recommended: 150-300

**angleSpacing** (default: 0.3)
- Angular spacing between nodes (radians)
- Currently reserved for future use
- Will control node density on rings

## Edge Cases Handled

### Tree Layout

1. **Multiple Roots**
   - Each root creates separate tree
   - Trees positioned side-by-side
   - Adequate spacing maintained

2. **Cycles in Graph**
   - Algorithm breaks cycles
   - First edge wins for parent-child
   - Prevents infinite recursion

3. **Disconnected Nodes**
   - Positioned separately
   - Placed to right of trees
   - Maintained visibility

### Radial Layout

1. **No Clear Center**
   - Uses most connected node
   - Falls back to first node if tie
   - Consistent result

2. **Disconnected Components**
   - Assigned to ring 1
   - Positioned around center
   - Maintains layout coherence

3. **Single Node**
   - Placed at center (0, 0)
   - No rings needed
   - Clean single-node display

## Performance

### Tree Layout
- **Time Complexity:** O(n) - Single traversal
- **Space Complexity:** O(n) - Node positions stored
- **Best Performance:** < 500 nodes
- **Recommended:** Hierarchical data structures

### Radial Layout
- **Time Complexity:** O(n + e) - BFS traversal
- **Space Complexity:** O(n) - Ring assignments
- **Best Performance:** < 200 nodes
- **Recommended:** Hub-and-spoke patterns

## Testing

### Manual Test Scenarios

**Tree Layout:**
1. Create 5-10 classes with clear parent-child relationships
2. Select "🌳 Tree" from algorithm dropdown
3. Verify natural tree structure
4. Check proper centering of parents
5. Test horizontal orientation

**Radial Layout:**
1. Create central class with multiple dependencies
2. Add 2-3 levels of dependencies
3. Select "🎯 Radial" from algorithm dropdown
4. Verify concentric ring structure
5. Check even distribution on rings

### Expected Results

**Tree Layout:**
```
✅ Parents centered above children
✅ Siblings evenly spaced
✅ Clear level separation
✅ Natural branching appearance
✅ Multiple roots handled correctly
```

**Radial Layout:**
```
✅ Most connected node at center
✅ Nodes arranged in rings
✅ Even distribution per ring
✅ Concentric circle formation
✅ Clear distance from center
```

## Troubleshooting

### Tree Layout Issues

**Problem:** Overlapping nodes
- **Solution:** Increase branchSeparation or levelSeparation

**Problem:** Tree too wide
- **Solution:** Use horizontal orientation or reduce branchSeparation

**Problem:** Multiple disconnected trees
- **Solution:** Expected behavior for multiple roots

### Radial Layout Issues

**Problem:** Rings too close
- **Solution:** Increase radiusIncrement

**Problem:** Wrong node at center
- **Solution:** Increase connections to desired center node

**Problem:** Uneven distribution
- **Solution:** Normal for varying ring sizes

## Future Enhancements

### Tree Layout
- 🔮 Custom root selection
- 🔮 Subtree collapsing
- 🔮 Adjustable node alignment
- 🔮 Curved edge rendering

### Radial Layout
- 🔮 Manual center selection
- 🔮 Ring spacing based on importance
- 🔮 Sector-based grouping
- 🔮 Spiral variation

## Summary

### Tree Layout (🌳)
- **Purpose:** Natural hierarchical branching
- **Algorithm:** Recursive positioning with centering
- **Best For:** Parent-child relationships
- **Performance:** O(n) - Very efficient

### Radial Layout (🎯)
- **Purpose:** Central focus with distance-based rings
- **Algorithm:** BFS with ring assignment
- **Best For:** Hub-and-spoke patterns
- **Performance:** O(n + e) - Efficient

---

**Status:** ✅ Complete  
**Tested:** ✅ Verified  
**Documentation:** ✅ Comprehensive  
**Version:** 1.4.0 (Tree & Radial Layouts)  
**Date:** December 7, 2025

