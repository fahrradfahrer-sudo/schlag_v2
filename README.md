# AgriField Manager - Field Management System

A production-ready web application for farmers to manage their fields using Leaflet and PHP. This system provides an intuitive interface for drawing, importing, and managing agricultural fields on a high-resolution satellite map.

## Features
- **Field Overview**: A sidebar listing all managed fields with quick actions.
- **Google Satellite Basemap**: Seamless integration with Google Satellite tiles for accurate field boundary identification.
- **Manual Drawing**: Use `Leaflet.draw` to manually outline field boundaries with polygon tools.
- **Import Support**:
    - **KML**: Direct import of Keyhole Markup Language files.
    - **Shapefile (SHP)**: Import zipped Shapefiles (must contain `.shp`, `.dbf`, and `.prj` files).
- **Field Management**: Add, Edit (name, notes, geometry), and Delete fields.
- **Data Persistence**: Robust SQLite backend using PHP PDO with prepared statements.
- **Security**: Built-in protection against XSS and SQL Injection.

## Project Structure
- `public/`: The web root. Contains `index.html`, `css/`, and `js/`.
- `public/api/`: RESTful PHP backend (`fields.php`).
- `data/`: Persistent storage for the SQLite database.
- `init_db.php`: Database initialization script.

## Running Locally
1. **Prerequisites**: Ensure you have PHP 7.4+ and the `php-sqlite3` extension installed.
2. **Initialize Database**: Run the initialization script from the project root:
   ```bash
   php init_db.php
   ```
3. **Start Development Server**:
   ```bash
   php -S localhost:8000 -t public/
   ```
4. **Access the Application**: Open [http://localhost:8000](http://localhost:8000) in your web browser.

## Integration with WordPress
To integrate this application into an existing WordPress site:
1. **Frontend**: Enqueue the required Leaflet and custom JS/CSS assets in your theme's `functions.php` or a custom plugin using `wp_enqueue_script` and `wp_enqueue_style`.
2. **Backend**:
    - Port the logic in `public/api/fields.php` to a custom WordPress REST API endpoint (`register_rest_route`).
    - Map the field data to a custom WordPress database table or use Custom Post Types (CPT) with Meta Fields for geometry storage.
3. **Template**: Create a custom page template in your theme to host the map container and sidebar.
