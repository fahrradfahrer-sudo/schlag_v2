<?php
header("Content-Type: application/json");

$query = $_GET['q'] ?? '';
$kennr = $_GET['kennr'] ?? '';

if ($kennr) {
    // Fetch details for a specific product
    $base_url = "https://psm-api.bvl.bund.de/ords/psm/api-v1/";

    function fetch_api($url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        $response = curl_exec($ch);
        curl_close($ch);
        return json_decode($response, true);
    }

    $q_kennr = urlencode(json_encode(["kennr" => $kennr]));
    $q_ebene = urlencode(json_encode(["ebene" => $kennr]));

    $mittel = fetch_api($base_url . "mittel/?q=" . $q_kennr);
    $auflagen = fetch_api($base_url . "auflagen/?q=" . $q_ebene);
    $awg = fetch_api($base_url . "awg/?q=" . $q_kennr);
    $wirkstoff_gehalt = fetch_api($base_url . "wirkstoff_gehalt/?q=" . $q_kennr);
    $wirkstoffe_data = [];
    if (isset($wirkstoff_gehalt['items'])) {
        // Fetch all wirkstoff definitions in one go (assuming they fit in one request or we don't have many)
        $wirknrs = array_unique(array_column($wirkstoff_gehalt['items'], 'wirknr'));
        $all_wirkstoffe = [];
        if (!empty($wirknrs)) {
            // BVL API doesn't seem to support IN queries easily via JSON q, so we might still need individual or just cache
            // But let's check if we can filter by wirknr using $in
            $q_wirk = urlencode(json_encode(["wirknr" => ["\$in" => array_values($wirknrs)]]));
            $w_infos = fetch_api($base_url . "wirkstoff/?q=" . $q_wirk);
            if (isset($w_infos['items'])) {
                foreach ($w_infos['items'] as $wi) {
                    $all_wirkstoffe[$wi['wirknr']] = $wi['wirkstoffname'];
                }
            }
        }

        foreach ($wirkstoff_gehalt['items'] as $wg) {
            $name = $all_wirkstoffe[$wg['wirknr']] ?? "Unknown ({$wg['wirknr']})";
            $wirkstoffe_data[] = [
                "name" => $name,
                "amount" => $wg['gehalt_rein'],
                "unit" => $wg['gehalt_rein_einheit'] ?? $wg['gehalt_einheit']
            ];
        }
    }

    $bee_safety = "N/A";
    if (isset($auflagen['items'])) {
        foreach ($auflagen['items'] as $item) {
            if (isset($item['auflage']) && strpos($item['auflage'], 'NB') === 0) {
                $bee_safety = $item['auflage'];
                break;
            }
        }
    }

    $awg_details = [];
    if (isset($awg['items'])) {
        // Limit AWGs to avoid too many requests
        $awg_items = array_slice($awg['items'], 0, 15);
        foreach ($awg_items as $a) {
            $awg_id = $a['awg_id'];
            $q_awg = urlencode(json_encode(["awg_id" => $awg_id]));

            $aufwand = fetch_api($base_url . "awg_aufwand/?q=" . $q_awg);
            $schadorg = fetch_api($base_url . "awg_schadorg/?q=" . $q_awg);
            $verw = fetch_api($base_url . "awg_verwendungszweck/?q=" . $q_awg);
            $kultur = fetch_api($base_url . "awg_kultur/?q=" . $q_awg);
            $wartezeit = fetch_api($base_url . "awg_wartezeit/?q=" . $q_awg);

            $awg_details[] = [
                "awg_id" => $awg_id,
                "anwendungsbereich" => $a['anwendungsbereich'],
                "stadium_kultur_bis" => $a['stadium_kultur_bis'],
                "stadium_kultur_von" => $a['stadium_kultur_von'],
                "aufwand" => $aufwand['items'] ?? [],
                "schadorg" => $schadorg['items'] ?? [],
                "verwendung" => $verw['items'] ?? [],
                "kultur" => $kultur['items'] ?? [],
                "wartezeit" => $wartezeit['items'] ?? []
            ];
        }
    }

    echo json_encode([
        "mittel" => $mittel['items'][0] ?? null,
        "bee_safety" => $bee_safety,
        "awg" => $awg_details,
        "auflagen" => $auflagen['items'] ?? [],
        "wirkstoffe" => $wirkstoffe_data
    ]);
    return;
}

if (!$query) {
    $api_url = "https://psm-api.bvl.bund.de/ords/psm/api-v1/mittel/?limit=50";
} else {
    $api_url = "https://psm-api.bvl.bund.de/ords/psm/api-v1/mittel/?q=" . urlencode(json_encode(["mittelname" => ["\$instr" => $query]]));
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$response = curl_exec($ch);
curl_close($ch);

echo $response;
