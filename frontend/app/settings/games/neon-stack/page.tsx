"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Trophy, Layers } from "lucide-react";

// --- Constants ---
const BOX_HEIGHT = 0.5;
const INITIAL_WIDTH = 3;
const INITIAL_DEPTH = 3;
const MOVE_SPEED = 0.08;
const CAMERA_OFFSET = 5;

interface Block {
    mesh: THREE.Mesh;
    width: number;
    depth: number;
    x: number;
    z: number;
}

export default function NeonStackGame() {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Game State
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [gameState, setGameState] = useState<"idle" | "playing" | "gameOver">("idle");
    
    // Refs for Three.js objects (to avoid re-renders)
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const stackRef = useRef<Block[]>([]);
    const currentBlockRef = useRef<Block | null>(null);
    const directionRef = useRef<1 | -1>(1);
    const axisRef = useRef<"x" | "z">("x");
    const frameIdRef = useRef<number>(0);

    // --- High Score Logic ---
    useEffect(() => {
        const saved = localStorage.getItem("neon_stack_highscore");
        if (saved) setHighScore(parseInt(saved));
    }, []);

    useEffect(() => {
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem("neon_stack_highscore", score.toString());
        }
    }, [score, highScore]);

    // --- Initialize Scene ---
    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x09090b);
        sceneRef.current = scene;

        // Camera (Orthographic for that nice stack look)
        const aspect = window.innerWidth / window.innerHeight;
        const d = 5;
        const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        camera.position.set(CAMERA_OFFSET, CAMERA_OFFSET, CAMERA_OFFSET);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvasRef.current, 
            antialias: true,
            alpha: true 
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        rendererRef.current = renderer;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7.5);
        dirLight.castShadow = true;
        scene.add(dirLight);

        // Resize handler
        const handleResize = () => {
            const aspect = window.innerWidth / window.innerHeight;
            camera.left = -d * aspect;
            camera.right = d * aspect;
            camera.top = d;
            camera.bottom = -d;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);

        // Start Initial Setup
        setupGame();

        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(frameIdRef.current);
            renderer.dispose();
        };
    }, []);

    const createBlock = (x: number, y: number, z: number, width: number, depth: number, color: number) => {
        const geometry = new THREE.BoxGeometry(width, BOX_HEIGHT, depth);
        const material = new THREE.MeshPhongMaterial({ 
            color, 
            emissive: color,
            emissiveIntensity: 0.2,
            shininess: 100 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        sceneRef.current?.add(mesh);
        return { mesh, width, depth, x, z };
    };

    const setupGame = () => {
        if (!sceneRef.current) return;

        // Clear scene
        while(sceneRef.current.children.length > 0){ 
            sceneRef.current.remove(sceneRef.current.children[0]); 
        }

        // Re-add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        sceneRef.current.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7.5);
        sceneRef.current.add(dirLight);

        // Initial base block
        const base = createBlock(0, 0, 0, INITIAL_WIDTH, INITIAL_DEPTH, 0x8b5cf6);
        stackRef.current = [base];
        setScore(0);
        setGameState("idle");

        // Reset camera
        if (cameraRef.current) {
            cameraRef.current.position.set(CAMERA_OFFSET, CAMERA_OFFSET, CAMERA_OFFSET);
            cameraRef.current.lookAt(0, 0, 0);
        }
    };

    const startGame = () => {
        setGameState("playing");
        spawnBlock();
        animate();
    };

    const spawnBlock = () => {
        const lastBlock = stackRef.current[stackRef.current.length - 1];
        const y = stackRef.current.length * BOX_HEIGHT;
        const color = new THREE.Color().setHSL((stackRef.current.length * 10 % 360) / 360, 0.7, 0.5).getHex();
        
        // Toggle axis
        axisRef.current = axisRef.current === "x" ? "z" : "x";
        
        let x = lastBlock.x;
        let z = lastBlock.z;

        if (axisRef.current === "x") {
            x = directionRef.current === 1 ? -5 : 5;
        } else {
            z = directionRef.current === 1 ? -5 : 5;
        }

        currentBlockRef.current = createBlock(x, y, z, lastBlock.width, lastBlock.depth, color);
    };

    const animate = () => {
        if (gameState === "gameOver") return;

        const block = currentBlockRef.current;
        if (block) {
            if (axisRef.current === "x") {
                block.mesh.position.x += MOVE_SPEED * directionRef.current;
                if (Math.abs(block.mesh.position.x) > 5) directionRef.current *= -1;
            } else {
                block.mesh.position.z += MOVE_SPEED * directionRef.current;
                if (Math.abs(block.mesh.position.z) > 5) directionRef.current *= -1;
            }
        }

        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        frameIdRef.current = requestAnimationFrame(animate);
    };

    const handleInteraction = () => {
        if (gameState === "idle") {
            startGame();
            return;
        }
        if (gameState === "gameOver") {
            setupGame();
            return;
        }

        const current = currentBlockRef.current;
        const last = stackRef.current[stackRef.current.length - 1];
        if (!current) return;

        const position = current.mesh.position;
        const delta = axisRef.current === "x" ? position.x - last.x : position.z - last.z;
        const size = axisRef.current === "x" ? current.width : current.depth;
        const overlap = size - Math.abs(delta);

        if (overlap > 0) {
            // Cut the block
            const newSize = overlap;
            const newCenter = last[axisRef.current] + delta / 2;

            current.mesh.scale[axisRef.current] = newSize / size;
            current.mesh.position[axisRef.current] = newCenter;
            
            // Update block data
            if (axisRef.current === "x") {
                current.width = newSize;
                current.x = newCenter;
            } else {
                current.depth = newSize;
                current.z = newCenter;
            }

            stackRef.current.push(current);
            setScore(s => s + 1);

            // Move camera up
            if (cameraRef.current) {
                const targetY = stackRef.current.length * BOX_HEIGHT + CAMERA_OFFSET;
                cameraRef.current.position.y = targetY;
                // Keep looking slightly ahead
                cameraRef.current.lookAt(0, stackRef.current.length * BOX_HEIGHT, 0);
            }

            spawnBlock();
        } else {
            // Game Over
            setGameState("gameOver");
            // Physics-like fall for the last block
            current.mesh.position.y -= 10;
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-[#09090b] flex flex-col items-center justify-center overflow-hidden touch-none"
            ref={containerRef}
            onClick={handleInteraction}
        >
            <canvas ref={canvasRef} className="w-full h-full cursor-pointer" />

            {/* UI Overlay */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none">
                <button 
                    onClick={(e) => { e.stopPropagation(); router.back(); }}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all pointer-events-auto"
                >
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>

                <div className="flex flex-col items-end gap-2">
                    <div className="px-6 py-3 rounded-3xl bg-white/5 border border-white/10 glass flex flex-col items-center">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Score</span>
                        <span className="text-3xl font-black text-primary italic leading-none">{score}</span>
                    </div>
                </div>
            </div>

            {/* Game Over / Start Overlay */}
            {(gameState === "idle" || gameState === "gameOver") && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="max-w-md w-full p-10 rounded-[2.5rem] bg-zinc-900/90 border border-white/10 shadow-2xl flex flex-col items-center gap-8 text-center glass">
                        <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center border border-primary/30">
                            <Layers className="w-10 h-10 text-primary" />
                        </div>

                        <div>
                            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                                {gameState === "idle" ? "Neon Stack" : "Game Over"}
                            </h2>
                            <p className="text-zinc-400 mt-2 font-medium">
                                {gameState === "idle" ? "Tap to stack the blocks as high as you can!" : "Mission terminated. Your protocol ended here."}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 w-full gap-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">Last Score</span>
                                <span className="text-2xl font-black text-white italic">{score}</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">Protocol Best</span>
                                <span className="text-2xl font-black text-primary italic">{highScore}</span>
                            </div>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); gameState === "idle" ? startGame() : setupGame(); }}
                            className="w-full py-5 rounded-2xl bg-primary text-black font-black uppercase italic tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] flex items-center justify-center gap-3"
                        >
                            {gameState === "idle" ? "Initiate" : <><RotateCcw className="w-5 h-5" /> Retry</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Touch Instruction */}
            {gameState === "playing" && score === 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 animate-bounce pointer-events-none">
                    <div className="px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs font-bold uppercase tracking-widest text-zinc-400">
                        Tap To Drop
                    </div>
                </div>
            )}
        </div>
    );
}
