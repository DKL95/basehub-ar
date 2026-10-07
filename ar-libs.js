// Librerías de la experiencia AR (módulos ES, incluidas en vendor/ para que
// funcionen sin conexión y dentro del APK). ar.js importa este archivo solo
// al entrar a la cámara, así el arranque de la app no carga ~3 MB de más.
//
//  - three.js r160 + GLTFLoader: escena 3D y modelos .glb (con soporte de
//    compresión meshopt para que los dioramas pesen menos).
//  - MindAR: reconocimiento y seguimiento de imágenes (los logos).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Controller } from "./vendor/mindar/mindar-image.prod.js";

export { THREE, GLTFLoader, MeshoptDecoder, Controller };
