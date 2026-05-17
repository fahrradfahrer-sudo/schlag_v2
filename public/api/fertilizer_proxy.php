<?php
header("Content-Type: application/json");

$method = $_SERVER['REQUEST_METHOD'];
$jsonPath = __DIR__ . '/../data/fertilizers.json';

if ($method === 'GET') {
    $query = $_GET['q'] ?? '';
    $json = file_get_contents($jsonPath);
    $fertilizers = json_decode($json, true);

    if (!$query) {
        echo json_encode($fertilizers);
        exit;
    }

    $filtered = array_filter($fertilizers, function($f) use ($query) {
        return stripos($f['name'], $query) !== false;
    });

    echo json_encode(array_values($filtered));
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!isset($data['name'])) {
        http_response_code(400);
        echo json_encode(["error" => "Missing fertilizer name"]);
        exit;
    }

    $json = file_get_contents($jsonPath);
    $fertilizers = json_decode($json, true);

    // Check if it already exists to avoid duplicates
    $exists = false;
    foreach ($fertilizers as $f) {
        if (strtolower($f['name']) === strtolower($data['name'])) {
            $exists = true;
            break;
        }
    }

    if (!$exists) {
        $newFert = [
            "name" => $data['name'],
            "n" => (float)($data['n'] ?? 0),
            "p" => (float)($data['p'] ?? 0),
            "k" => (float)($data['k'] ?? 0),
            "s" => (float)($data['s'] ?? 0),
            "description" => $data['description'] ?? ""
        ];
        $fertilizers[] = $newFert;
        file_put_contents($jsonPath, json_encode($fertilizers, JSON_PRETTY_PRINT));
        echo json_encode(["status" => "success", "message" => "Fertilizer saved"]);
    } else {
        echo json_encode(["status" => "exists", "message" => "Fertilizer already exists"]);
    }
} else {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
}
