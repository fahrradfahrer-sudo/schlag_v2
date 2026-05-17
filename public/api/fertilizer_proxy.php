<?php
header("Content-Type: application/json");

$query = $_GET['q'] ?? '';
$json = file_get_contents(__DIR__ . '/../data/fertilizers.json');
$fertilizers = json_decode($json, true);

if (!$query) {
    echo json_encode($fertilizers);
    exit;
}

$filtered = array_filter($fertilizers, function($f) use ($query) {
    return stripos($f['name'], $query) !== false;
});

echo json_encode(array_values($filtered));
