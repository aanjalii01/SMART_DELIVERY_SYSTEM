import math


def calculate_distance(lat1, lng1, lat2, lng2):
    """Calculate the great-circle distance between two coordinates."""
    R = 6371  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_route_distance(route, start_point=None):
    """Return total travel distance for the route, optionally from a start point."""
    total_distance = 0.0
    if start_point and route:
        total_distance += calculate_distance(
            start_point['lat'], start_point['lng'], route[0]['lat'], route[0]['lng']
        )

    for index in range(len(route) - 1):
        total_distance += calculate_distance(
            route[index]['lat'], route[index]['lng'],
            route[index + 1]['lat'], route[index + 1]['lng']
        )

    return total_distance


def two_opt_route(route, start_point=None):
    """Improve a route using the 2-opt heuristic while preserving the final destination."""
    if len(route) < 3:
        return route

    best_route = route[:]
    best_distance = calculate_route_distance(best_route, start_point)
    improved = True

    while improved:
        improved = False
        for i in range(len(best_route) - 2):
            for j in range(i + 1, len(best_route) - 1):
                new_route = best_route[:i] + list(reversed(best_route[i:j + 1])) + best_route[j + 1:]
                if new_route[-1] != best_route[-1]:
                    continue

                new_distance = calculate_route_distance(new_route, start_point)
                if new_distance + 1e-6 < best_distance:
                    best_route = new_route
                    best_distance = new_distance
                    improved = True
        if improved:
            continue

    return best_route


def calculate_optimized_route(pickup_locations, delivery_location, start_point=None):
    """Compute an optimized pickup and delivery route using nearest-neighbor and 2-opt."""
    if not pickup_locations:
        return [delivery_location]

    best_route = None
    best_distance = float('inf')

    for start_index in range(len(pickup_locations)):
        remaining = pickup_locations[:]
        current = remaining.pop(start_index)
        route = [current]

        while remaining:
            next_location = min(
                remaining,
                key=lambda location: calculate_distance(
                    current['lat'], current['lng'], location['lat'], location['lng']
                )
            )
            route.append(next_location)
            remaining.remove(next_location)
            current = next_location

        route.append(delivery_location)
        route = two_opt_route(route, start_point)
        total_distance = calculate_route_distance(route, start_point)

        if total_distance < best_distance:
            best_route = route
            best_distance = total_distance

    return best_route or [delivery_location]


def choose_best_drone(available_drones, pickup_locations, delivery_location, total_weight):
    """Choose the available drone with the most efficient route and sufficient capacity."""
    best_allocation = None

    for drone in available_drones:
        if drone.max_weight is not None and total_weight > drone.max_weight:
            continue

        start_point = {'lat': drone.current_lat, 'lng': drone.current_lng}
        optimized_route = calculate_optimized_route(pickup_locations, delivery_location, start_point)
        route_distance = calculate_route_distance(optimized_route, start_point)

        candidate = {
            'drone': drone,
            'route': optimized_route,
            'total_distance': route_distance,
            'battery_level': drone.battery_level
        }

        if best_allocation is None:
            best_allocation = candidate
            continue

        if candidate['total_distance'] < best_allocation['total_distance']:
            best_allocation = candidate
        elif candidate['total_distance'] == best_allocation['total_distance'] and candidate['battery_level'] > best_allocation['battery_level']:
            best_allocation = candidate

    return best_allocation
