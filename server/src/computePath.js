"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePath = void 0;
const testEdges = [
    [0, 1, 4, 3],
    [1, 0, 2, 2],
    [4, 2, 0, 1],
    [3, 2, 1, 0],
];
const computePath = (rangeMax, edges) => {
    // goal: path under rangeMax starting and ending at source with maximum number of nodes
    return dfs(0, rangeMax, [0], 
    // new Array(edges.length).fill(false),
    edges).path.slice(1);
};
exports.computePath = computePath;
const dfs = (currentPathLen, maxPathLen, 
// currentNumNodes: number,
currentPath, 
// visited: boolean[],
edges) => {
    const getEdge = (i, j) => {
        return edges[i][j] || edges[j][i];
    };
    // console.log(`*** starting DFS with path ${currentPath}`);
    // console.log(`currentPathLen: ${currentPathLen}`);
    if (currentPathLen > maxPathLen) {
        // console.log(`returning because path too long.`);
        return {
            maxNumberNodes: -1,
            path: currentPath,
            pathLengthInMeters: currentPathLen,
        };
    }
    // visited[currentNode.nodeIdx] = true;
    // let maxOfNeighbors = -1;
    // let maxNeighborNodePath;
    let maxNeighbor = {
        maxNumberNodes: -1,
        path: [],
        pathLengthInMeters: 0,
    };
    // console.log(`starting on neighbors`);
    for (let i = 1; i < edges.length; i++) {
        if (!currentPath.includes(i)) {
            let nodeValue = dfs(currentPathLen + getEdge(i, currentPath[currentPath.length - 1]), // path length
            maxPathLen, // max path len doesnt change
            currentPath.concat([i]), // new path
            // visited, // visited array doesnt change
            edges // edges dont change
            );
            if (nodeValue.maxNumberNodes > maxNeighbor.maxNumberNodes ||
                (nodeValue.maxNumberNodes === maxNeighbor.maxNumberNodes &&
                    nodeValue.pathLengthInMeters > maxNeighbor.pathLengthInMeters)) {
                maxNeighbor = nodeValue;
                // maxOfNeighbors = nodeValue.maxNumberNodes;
                // maxNeighborNodePath = nodeValue.path;
            }
        }
    }
    // if neighbors have successful paths, return
    if (maxNeighbor.maxNumberNodes > -1 && maxNeighbor.path.length > 0) {
        // console.log(
        // 	`ending with path ${currentPath}, found neighbor path ${maxNeighborNodePath}`
        // );
        return { ...maxNeighbor, maxNumberNodes: maxNeighbor.maxNumberNodes + 1 };
    }
    // otherwise, check if current node has acceptable path
    if (currentPathLen + getEdge(0, currentPath[currentPath.length - 1]) <
        maxPathLen) {
        // console.log(`ending with path ${currentPath}, found path back to source`);
        return {
            maxNumberNodes: 0,
            path: currentPath,
            pathLengthInMeters: currentPathLen,
        };
    }
    // no acceptable paths
    // console.log(`ending with path ${currentPath}, nothing found from this node`);
    return { maxNumberNodes: -1, path: [], pathLengthInMeters: 0 };
};
