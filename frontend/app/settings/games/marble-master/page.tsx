"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Gem, HelpCircle } from "lucide-react";

// --- Constants ---
const MARBLE_RADIUS = 0.3;
const PLATFORM_SIZE = 10;
const GRAVITY = -0.15;
const FRICTION = 0.98;
const MOVE_FORCE = 0.02;

export default function MarbleMasterGame() {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Game State
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [gameState, setGameState] = useState<"idle" | "playing" | "gameOver">("idle");
    
    // Three.js Refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const marbleRef = useRef<THREE.Mesh | null>(null);
    const platformRef = useRef<THREE.Mesh | null>(null);
    const gemsRef = useRef<THREE.Mesh[]>([]);
    
    // Physics State
    const velocity = useRef({ x: 0, y: 0, z: 0 });
    const frameIdRef = useRef<number>(0);
    const touchStart = useRef({ x: 0, y: 0 });

    // --- High Score Logic ---
    useEffect(() => {
        const saved = localStorage.getItem("marble_master_highscore");
        if (saved) setHighScore(parseInt(saved));
    }, []);

    useEffect(() => {
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem("marble_master_highscore", score.toString());
        }
    }, [score, highScore]);

    // --- Initialize Scene ---
    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050507);
        scene.fog = new THREE.FogExp2(0x050507, 0.05);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 8, 8);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvasRef.current, 
            antialias: true 
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        rendererRef.current = renderer;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x00ffff, 2, 20);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);

        const spotLight = new THREE.SpotLight(0xffffff, 1);
        spotLight.position.set(0, 15, 0);
        spotLight.castShadow = true;
        scene.add(spotLight);

        // Setup Scene
        setupGame();

        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = window.innerWidth / window.innerHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(frameIdRef.current);
            renderer.dispose();
        };
    }, []);

    const setupGame = () => {
        if (!sceneRef.current) return;

        // Clear Gems
        gemsRef.current.forEach(gem => sceneRef.current?.remove(gem));
        gemsRef.current = [];

        // Marble
        if (!marbleRef.current) {
            const marbleGeo = new THREE.SphereGeometry(MARBLE_RADIUS, 32, 32);
            const marbleMat = new THREE.MeshPhongMaterial({ 
                color: 0xffffff, 
                shininess: 100, 
                reflectivity: 1,
                emissive: 0x444444
            });
            const marble = new THREE.Mesh(marbleGeo, marbleMat);
            marble.castShadow = true;
            marble.receiveShadow = true;
            marbleRef.current = marble;
            sceneRef.current.add(marble);
        }
        marbleRef.current.position.set(0, MARBLE_RADIUS + 0.1, 0);
        velocity.current = { x: 0, y: 0, z: 0 };

        // Platform
        if (!platformRef.current) {
            const platformGeo = new THREE.BoxGeometry(PLATFORM_SIZE, 0.5, PLATFORM_SIZE);
            const platformMat = new THREE.MeshStandardMaterial({ 
                color: 0x1f1f23, 
                metalness: 0.8, 
                roughness: 0.2 
            });
            const platform = new THREE.Mesh(platformGeo, platformMat);
            platform.receiveShadow = true;
            platformRef.current = platform;
            sceneRef.current.add(platform);

            // Grid helper for better depth perception
            const grid = new THREE.GridHelper(PLATFORM_SIZE, 10, 0x00ffff, 0x222222);
            grid.position.y = 0.26;
            sceneRef.current.add(grid);
        }

        setScore(0);
        setGameState("idle");
        spawnGem();
    };

    const spawnGem = () => {
        const gemGeo = new THREE.OctahedronGeometry(0.25, 0);
        const gemMat = new THREE.MeshPhongMaterial({ 
            color: 0x00ff88, 
            emissive: 0x00ff88, 
            emissiveIntensity: 0.5 
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        
        const x = (Math.random() - 0.5) * (PLATFORM_SIZE - 2);
        const z = (Math.random() - 0.5) * (PLATFORM_SIZE - 2);
        gem.position.set(x, 0.6, z);
        gem.castShadow = true;
        
        sceneRef.current?.add(gem);
        gemsRef.current.push(gem);
    };

    const startGame = () => {
        setGameState("playing");
        animate();
    };

    const animate = () => {
        if (gameState === "gameOver") return;

        const marble = marbleRef.current;
        if (!marble) return;

        // Apply velocities
        if (marble.position.y > MARBLE_RADIUS) {
            // Apply Gravity
            velocity.current.y += GRAVITY;
            
            // On platform check
            if (marble.position.y + velocity.current.y <= MARBLE_RADIUS + 0.25) {
                const mx = Math.abs(marble.position.x);
                const mz = Math.abs(marble.position.z);
                
                if (mx < PLATFORM_SIZE / 2 && mz < PLATFORM_SIZE / 2) {
                    marble.position.y = MARBLE_RADIUS + 0.25;
                    velocity.current.y = 0;
                }
            }
        }

        // Friction and Movement
        velocity.current.x *= FRICTION;
        velocity.current.z *= FRICTION;

        marble.position.x += velocity.current.x;
        marble.position.y += velocity.current.y;
        marble.position.z += velocity.current.z;

        // Rotate marble based on movement
        marble.rotation.x += velocity.current.z;
        marble.rotation.z -= velocity.current.x;

        // Check Gems Collision
        gemsRef.current.forEach((gem, index) => {
            const dist = marble.position.distanceTo(gem.position);
            if (dist < 0.6) {
                sceneRef.current?.remove(gem);
                gemsRef.current.splice(index, 1);
                setScore(s => s + 10);
                spawnGem();
            }
            gem.rotation.y += 0.05;
        });

        // Fall Off check
        if (marble.position.y < -5) {
            setGameState("gameOver");
        }

        // Camera follow (slight)
        if (cameraRef.current) {
            cameraRef.current.position.x = marble.position.x * 0.5;
            cameraRef.current.lookAt(marble.position.x * 0.8, 0, marble.position.z * 0.8);
        }

        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        frameIdRef.current = requestAnimationFrame(animate);
    };

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        if (gameState !== "playing") return;
        const x = "touches" in e ? e.touches[0].clientX : e.clientX;
        const y = "touches" in e ? e.touches[0].clientY : e.clientY;
        touchStart.current = { x, y };
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (gameState !== "playing") return;
        const x = "touches" in e ? e.touches[0].clientX : e.clientX;
        const y = "touches" in e ? e.touches[0].clientY : e.clientY;
        
        const dx = x - touchStart.current.x;
        const dy = y - touchStart.current.y;

        velocity.current.x += dx * 0.0005;
        velocity.current.z += dy * 0.0005;

        touchStart.current = { x, y };
    };

    return (
        <div 
            className="fixed inset-0 bg-[#050507] flex flex-col items-center justify-center overflow-hidden touch-none"
            ref={containerRef}
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
        >
            <canvas ref={canvasRef} className="w-full h-full" />

            {/* UI Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none">
                <button 
                    onClick={(e) => { e.stopPropagation(); router.back(); }}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all pointer-events-auto"
                >
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>

                <div className="px-6 py-3 rounded-3xl bg-white/5 border border-white/10 glass flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Gems Collected</span>
                    <span className="text-3xl font-black text-emerald-400 italic leading-none">{score}</span>
                </div>
            </div>

            {/* Menus */}
            {(gameState === "idle" || gameState === "gameOver") && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="max-w-md w-full p-10 rounded-[2.5rem] bg-zinc-900/90 border border-white/10 shadow-2xl flex flex-col items-center gap-8 text-center glass">
                        <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                            <Gem className="w-10 h-10 text-emerald-400" />
                        </div>

                        <div>
                            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                                {gameState === "idle" ? "Marble Master" : "Marble Lost"}
                            </h2>
                            <p className="text-zinc-400 mt-2 font-medium">
                                {gameState === "idle" ? "Swipe to control the marble. Don't fall off the platform!" : "The marble has descended into the void."}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 w-full gap-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">Collected</span>
                                <span className="text-2xl font-black text-white italic">{score}</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">Global Best</span>
                                <span className="text-2xl font-black text-emerald-400 italic">{highScore}</span>
                            </div>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); gameState === "idle" ? startGame() : setupGame(); }}
                            className="w-full py-5 rounded-2xl bg-emerald-500 text-black font-black uppercase italic tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-3"
                        >
                            {gameState === "idle" ? "Engage" : <><RotateCcw className="w-5 h-5" /> Re-Spawn</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Swipe Instruction */}
            {gameState === "playing" && score === 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 animate-bounce pointer-events-none">
                    <div className="px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
                        <HelpCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Swipe to Move</span>
                    </div>
                </div>
            )}
        </div>
    );
}
