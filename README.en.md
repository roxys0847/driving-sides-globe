# Driving Sides Globe

**[中文](./README.md) · English**

Explore which side of the road the world drives on through an interactive 3D-style globe.

🌐 **[Open the live site](https://repeak.dpdns.org)**

Countries and regions are distinguished by color, while diagonal shading makes the traffic direction visible at a glance: upper-left shading represents left-hand traffic, and lower-right shading represents right-hand traffic.

## Features

- Interactive globe with automatic rotation, manual rotation, and zoom controls
- Separate colors and directional shading for left- and right-hand traffic
- Chinese primary names, English secondary names, and country or region flags
- Search for countries and regions, including small areas such as Macao
- Country details showing the flag, bilingual name, and traffic direction
- Left- and right-hand traffic filters with live region totals
- Browser geolocation request, map marker, and location-centered initial view
- Responsive desktop and mobile layout
- One-finger rotation and two-finger pinch zoom on touch devices
- Reduced-motion support and accessible control labels

## How to Use

### Desktop

- Drag the globe to rotate it.
- Use the mouse wheel or the `+` and `−` buttons to zoom.
- Select the pause button to stop or resume automatic rotation.
- Search for a country or region from the search bar.
- Select a country or region to view its details without forcing the globe to recenter.

### Mobile

- Drag with one finger to rotate the globe.
- Pinch with two fingers to zoom.
- Allow location access to center the initial view on your current position and display a marker.

## Traffic Direction Legend

| Direction | Visual cue |
| --- | --- |
| Left-hand traffic | Cyan-toned regions with shading toward the upper left `↖` |
| Right-hand traffic | Orange-toned regions with shading toward the lower right `↘` |

## Technology

- [React](https://react.dev/) and [vinext](https://github.com/cloudflare/vinext)
- [D3 Geo](https://d3js.org/d3-geo) for geographic projection and path rendering
- [TopoJSON](https://github.com/topojson/topojson-client) and [world-atlas](https://github.com/topojson/world-atlas) for map data
- HTML Canvas for globe rendering and interaction
- OpenAI Sites for hosting

## Local Development

### Prerequisite

- Node.js `>=22.13.0`

### Start the Project

```bash
npm install
npm run dev
```

### Validation

```bash
npm run build
npm test
```

## Project Structure

- `app/page.tsx`: globe rendering, interaction, search, filters, and geolocation
- `app/country-names.ts`: country and region name and code mappings
- `app/globals.css`: responsive layout and visual styling
- `.openai/hosting.json`: OpenAI Sites project configuration

## Online Version

- Website: [https://repeak.dpdns.org](https://repeak.dpdns.org)
- GitHub release: [v1.0.0](https://github.com/roxys0847/driving-sides-globe/releases/tag/v1.0.0)
