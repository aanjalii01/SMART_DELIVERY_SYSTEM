def dijkstra(graph, start):
    import heapq
    dist = {node: float('inf') for node in graph}
    dist[start] = 0
    queue = [(0, start)]
    while queue:
        curr_dist, curr_node = heapq.heappop(queue)
        for neighbor, weight in graph[curr_node].items():
            distance = curr_dist + weight
            if distance < dist[neighbor]:
                dist[neighbor] = distance
                heapq.heappush(queue, (distance, neighbor))
    return dist

def shortest_path(graph, start, end):
    # This example returns only the distance
    dist_map = dijkstra(graph, start)
    return dist_map.get(end, float('inf'))