# Three.js Texture Application Options Guide

## Overview
When you click "Generate 3D Preview", the console will now show detailed information about:
- All texture properties being applied
- Mesh geometry details (vertices, faces, UV mapping)
- Bounding box dimensions
- UV coordinate ranges

---

## 1. WRAPPING MODES (`wrapS` and `wrapT`)

Controls what happens when UV coordinates exceed 0-1 range.

### Option A: `THREE.ClampToEdgeWrapping` ⭐ (Current)
```javascript
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
```
- **Effect**: Edge pixels are stretched to fill
- **Best for**: Stretching image to fit entire surface
- **Problem**: Can cause stretching/distortion if UV mapping doesn't match image aspect ratio

### Option B: `THREE.RepeatWrapping`
```javascript
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
```
- **Effect**: Texture tiles/repeats seamlessly
- **Best for**: Repeating patterns (fabrics, tiles)
- **Problem**: Image will repeat if surface is larger than texture

### Option C: `THREE.MirroredRepeatWrapping`
```javascript
texture.wrapS = THREE.MirroredRepeatWrapping;
texture.wrapT = THREE.MirroredRepeatWrapping;
```
- **Effect**: Tiles with mirroring (creates seamless transitions)
- **Best for**: Creating kaleidoscope-like patterns
- **Problem**: Image will look mirrored

---

## 2. REPEAT/SCALE (`repeat`)

Controls how many times the texture repeats or how zoomed in/out it is.

### Standard (Current)
```javascript
texture.repeat.set(1, 1);  // Full texture, no repeat
```

### Zoom In
```javascript
texture.repeat.set(0.5, 0.5);  // Texture appears 2x larger (zoomed in)
```

### Stretch Horizontally
```javascript
texture.repeat.set(2, 1);  // Texture compressed horizontally (or repeats 2x)
```

### Stretch Vertically
```javascript
texture.repeat.set(1, 2);  // Texture compressed vertically (or repeats 2x)
```

**Note**: Effect depends on wrapping mode
- With `ClampToEdgeWrapping`: Values < 1 zoom in, > 1 zoom out
- With `RepeatWrapping`: Values indicate number of repetitions

---

## 3. OFFSET/POSITION (`offset`)

Shifts the texture position on the surface.

### Current Configuration (at top of file)
```javascript
const TEXTURE_OFFSETS = {
  external: { x: 0.5, y: 0.5 },  // Pattern_25178
  bottom: { x: 0.5, y: 0.5 }     // Pattern_4474
};
```

### How it works:
- **X-axis**: `0 = left edge`, `0.5 = center`, `1 = right edge`
- **Y-axis**: `0 = bottom edge`, `0.5 = center`, `1 = top edge`
- **Positive values**: Move right/up
- **Negative values**: Move left/down

### Examples:
```javascript
texture.offset.set(0, 0);      // Bottom-left corner
texture.offset.set(0.5, 0.5);  // Centered
texture.offset.set(1, 1);      // Top-right corner
texture.offset.set(-0.25, 0);  // Shift left by 25%
```

---

## 4. ROTATION (`rotation` and `center`)

Rotates the texture around a pivot point.

### Enable Rotation (Currently Commented Out)
```javascript
texture.rotation = Math.PI / 2;  // 90 degrees clockwise
texture.center.set(0.5, 0.5);    // Rotate around center
```

### Rotation Values:
- `0` = No rotation
- `Math.PI / 4` = 45° clockwise
- `Math.PI / 2` = 90° clockwise
- `Math.PI` = 180°
- `Math.PI * 1.5` = 270° clockwise
- `-Math.PI / 2` = 90° counter-clockwise

### Rotation Center:
```javascript
texture.center.set(0, 0);      // Rotate around bottom-left
texture.center.set(0.5, 0.5);  // Rotate around center (default)
texture.center.set(1, 1);      // Rotate around top-right
```

---

## 5. FLIP (`flipY`)

Flips the texture vertically.

### Current (Enabled)
```javascript
texture.flipY = true;  // Flips texture upside down
```

### Options:
- `true`: Texture is flipped vertically
- `false`: Texture appears as-is

**Note**: Sometimes needed depending on how the OBJ file was exported and its UV mapping orientation.

---

## 6. COMMON COMBINATIONS FOR YOUR USE CASE

### A. Stretch to Fill (Current Setup)
```javascript
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
texture.repeat.set(1, 1);
texture.offset.set(0.5, 0.5);  // Centered
```
**Use when**: You want the entire image to cover the surface

---

### B. Tile/Repeat Pattern
```javascript
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(2, 2);  // Repeat 2x in each direction
texture.offset.set(0, 0);
```
**Use when**: Image is a seamless pattern that should tile

---

### C. Fit Without Distortion (Letterbox)
```javascript
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
// Calculate repeat based on aspect ratios
const imageAspect = imageWidth / imageHeight;
const surfaceAspect = surfaceWidth / surfaceHeight;
if (imageAspect > surfaceAspect) {
  texture.repeat.set(1, surfaceAspect / imageAspect);
} else {
  texture.repeat.set(imageAspect / surfaceAspect, 1);
}
texture.offset.set(0.5, 0.5);  // Center
```
**Use when**: You want to maintain aspect ratio (may leave gaps)

---

### D. Zoom In and Pan
```javascript
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
texture.repeat.set(0.7, 0.7);  // Zoom in 30%
texture.offset.set(0.3, 0.6);  // Pan to specific area
```
**Use when**: You want to focus on a specific part of the image

---

## 7. DEBUGGING

When you click "Generate 3D Preview", check the console for:

### Texture Properties Section
```
═══════════════════════════════════════
EXTERNAL PANEL TEXTURE (Pattern_25178)
═══════════════════════════════════════
Texture Properties:
  - wrapS: ClampToEdgeWrapping
  - wrapT: ClampToEdgeWrapping
  - repeat: (1, 1)
  - offset: (0.5, 0.5)
  - rotation: 0 radians (0.0°)
  - center: (0, 0)
  - flipY: true
```

### Mesh Info Section
```
✓ Applying EXTERNAL texture to Pattern_25178
  Mesh Info:
    - Vertices: 2547
    - Faces: 1698
    - Has UV mapping: true
    - UV coordinates count: 2547
    - UV range: U[0, 1], V[0, 1]
    - Bounding box:
      Min: (-44.83, 5.81, 10.89)
      Max: (31.96, 9.29, 46.12)
      Size: (76.79, 3.48, 35.23)
```

**Important UV Info**:
- If UV range is **[0, 1]**: Surface is properly UV mapped
- If UV range exceeds [0, 1]: Texture will repeat (with RepeatWrapping) or stretch edges (with ClampToEdgeWrapping)
- If no UV mapping: Texture won't display properly

---

## 8. TROUBLESHOOTING

### Problem: Image is stretched/distorted
**Solution**:
- Try different `repeat` values to match aspect ratios
- Or use `RepeatWrapping` to tile instead

### Problem: Image appears in wrong location
**Solution**:
- Adjust `offset` values
- Check UV mapping range in console logs

### Problem: Image is upside down
**Solution**:
- Toggle `flipY` between `true` and `false`

### Problem: Image doesn't fill the surface
**Solution**:
- Ensure `wrapS` and `wrapT` are set to `ClampToEdgeWrapping`
- Set `repeat` to `(1, 1)`
- Check if UV coordinates go beyond 0-1 range

### Problem: Image repeats when it shouldn't
**Solution**:
- Change from `RepeatWrapping` to `ClampToEdgeWrapping`

---

## Where to Edit in Code

Find these sections in `fabric-preview.html`:

1. **Texture Offsets** (Line ~264):
```javascript
const TEXTURE_OFFSETS = {
  external: { x: 0.5, y: 0.5 },
  bottom: { x: 0.5, y: 0.5 }
};
```

2. **External Panel Texture** (Line ~875):
```javascript
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
texture.repeat.set(1, 1);
// etc...
```

3. **Bottom Panel Texture** (Line ~920):
```javascript
texture.wrapS = THREE.ClampToEdgeWrapping;
texture.wrapT = THREE.ClampToEdgeWrapping;
texture.repeat.set(1, 1);
// etc...
```
