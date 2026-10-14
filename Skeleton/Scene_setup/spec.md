### Specification for AI agent: Scene setup

#### Scene setup
In the main entry point `main.js`, implement the following:
- Create a new `THREE.Scene()`.
- Set a modern dark atmospheric background color:
  ```js
  scene.background = new THREE.Color(0x0f0f1a); // deep dark blue-black
  ```
- Add subtle fog for better depth and atmosphere:
  ```js
  scene.fog = new THREE.Fog(0x0f0f1a, 600, 2800);
  ```

#### Lighting
In the main entry point `main.js`, implement the following:

**Original requirements (keep these):**
- Add an `AmbientLight` to the scene with an intensity of `1.5` to provide base illumination.
- Add a `DirectionalLight` to the scene to create shadows and depth. Set the intensity to `1.5` and positioned to `(-100, -100, 200)`.

**Enhanced additions (must implement):**
- Improve the AmbientLight color to `0xa0b0d0` (cool soft blue-gray) while keeping intensity around 1.2–1.5.
- Improve the main DirectionalLight:
  - Color: `0xfff0dd` (warm soft white)
  - Intensity: `1.8` – `1.9`
  - Position: `(-140, -160, 280)` (slightly adjusted for better angle)
  - Enable high-quality shadows:
    ```js
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    directionalLight.shadow.camera.near = 10;
    directionalLight.shadow.camera.far = 1200;
    directionalLight.shadow.bias = -0.0001;
    ```
- Add a Fill Light (DirectionalLight):
  - Color: `0x88c0ff`
  - Intensity: `0.55`
  - Position: `(160, 120, 200)`
- Add a Rim / Accent PointLight for modern look:
  - Color: `0x00e6b8` (teal/cyan)
  - Intensity: `1.0`
  - Position: `(0, -40, 160)`
  - Distance: `700`

#### Player
In the `components` directory, create a file named `Player.js` with the following implementation:
- The player should be represented by a `THREE.Group`.
- Load the 3D model `tode.glb` from `public/models/`.
- Add the model as a child of the `THREE.Group`.
- Positioning:
  - Place the group at the center of the scene.
  - Calculate the Z-offset based on the model height to ensure Tode sits flush on the ground.
  - Add model rotation: `model.rotation.x = Math.PI / 2;`.
- Scale the model using a scalar of `20`.

**Enhanced additions:**
- After loading the model, enable shadows on all meshes:
  ```js
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  ```
- Make sure the model is properly centered using bounding box calculation so it sits perfectly on the ground.
- Export a clean `createPlayer()` function that returns the `THREE.Group`.

Add the player to the main entry point `main.js`.

#### Camera
In the `components` directory, create a file named `Camera.js` with the following implementation:
- A perspective camera with a 30° field of view and the far plane set to `9000`.
- Set the initial camera position to `(300, -300, 300)` and set `camera.up` to `(0, 0, 1)`.
- Point the camera at the origin `(0, 0, 0)`.

**Enhanced additions:**
- You may slightly improve FOV to `32` for better framing (optional but recommended).
- Position can be fine-tuned to `(290, -310, 290)` if it looks better.
- Export a `createCamera()` function.

In the main entry point `main.js`:
- Add the camera as a child of the player group: `player.add(camera)`.

#### Renderer
In the `components` directory, create `Renderer.js` with the following implementation:
- Initialize `THREE.WebGLRenderer`.
- Use `canvas.game` in `index.html` as the rendering canvas.
- Enable `alpha: true` and `antialias: true`.
- Set the renderer size to match the window dimensions.

**Enhanced additions (must implement):**
```js
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas.game'),
  alpha: true,
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Modern color & tone mapping
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

Add the renderer to the main entry point `main.js`.

---

### Extra Recommended Polish (Strongly Suggested)

- Add a simple ground plane for better visual quality:
  - `THREE.CircleGeometry(1200, 64)`
  - Material color: `0x12121f`
  - `receiveShadow = true`
  - Slightly below the player

- Create a proper animation loop in `main.js`:
  ```js
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
  ```

- Add window resize handler so the game stays responsive.

---

### Final Notes for the Agent
- Keep the original structure and requirements fully intact.
- Only enhance and improve on top of the original specification.
- Code must stay modular (Player.js, Camera.js, Renderer.js).
- Final result should look modern, clean, and atmospheric — not flat.
```