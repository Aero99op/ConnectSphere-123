"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Zap, Rocket } from "lucide-react";

// --- Constants ---
const LANE_WIDTH = 2;
const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
const INITIAL_SPEED = 0.2;
const SPEED_INC = 0.0001;
const OBSTACLE_SPAWN_DIST = 20;

export default function CyberRunnerGame() {
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
    const playerRef = useRef<THREE.Mesh | null>(null);
    const obstaclesRef = useRef<THREE.Mesh[]>([]);
    const groundRef = useRef<THREE.Group | null>(null);
    
    // Gameplay Vars
    const speed = useRef(INITIAL_SPEED);
    const currentLane = useRef(1); // Index in LANES (0, 1, 2)
    const targetX = useRef(0);
    const frameIdRef = useRef<number>(0);

    // --- High Score Logic ---
    useEffect(() => {
        const saved = localStorage.getItem("cyber_runner_highscore");
        if (saved) setHighScore(parseInt(saved));
    }, []);

    useEffect(() => {
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem("cyber_runner_highscore", score.toString());
        }
    }, [score, highScore]);

    // --- Initialize Scene ---
    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050507);
        scene.fog = new THREE.Fog(0x050507, 10, 50);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 3, 7);
        camera.lookAt(0, 1, -5);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvasRef.current, 
            antialias: true 
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current = renderer;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0x00ffff, 0xff00ff, 0.6);
        scene.add(hemiLight);

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

        // Reset
        obstaclesRef.current.forEach(o => sceneRef.current?.remove(o));
        obstaclesRef.current = [];
        speed.current = INITIAL_SPEED;
        currentLane.current = 1;
        targetX.current = 0;
        setScore(0);
        setGameState("idle");

        // Player (Ship/Cube)
        if (!playerRef.current) {
            const playerGeo = new THREE.ConeGeometry(0.4, 1, 4);
            const playerMat = new THREE.MeshPhongMaterial({ 
                color: 0x00ffff, 
                emissive: 0x00ffff, 
                emissiveIntensity: 0.5 
            });
            const player = new THREE.Mesh(playerGeo, playerMat);
            player.rotation.x = Math.PI / 2;
            player.position.y = 0.5;
            playerRef.current = player;
            sceneRef.current.add(player);
        }
        playerRef.current.position.x = 0;

        // Ground/Grid
        if (!groundRef.current) {
            const group = new THREE.Group();
            
            // Neon track
            const trackGeo = new THREE.PlaneGeometry(LANE_WIDTH * 3 + 1, 100);
            const trackMat = new THREE.MeshStandardMaterial({ 
                color: 0x111111, 
                metalness: 0.9, 
                roughness: 0.1 
            });
            const track = new THREE.Mesh(trackGeo, trackMat);
            track.rotation.x = -Math.PI / 2;
            group.add(track);

            // Grid lines
            const grid = new THREE.GridHelper(100, 50, 0x00ffff, 0x111111);
            grid.rotation.x = -Math.PI / 2; // Keep it on the track
            grid.position.y = 0.01;
            group.add(grid);

            groundRef.current = group;
            sceneRef.current.add(group);
        }
    };

    const spawnObstacle = () => {
        const laneIdx = Math.floor(Math.random() * 3);
        const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const mat = new THREE.MeshPhongMaterial({ 
            color: 0xff00ff, 
            emissive: 0xff00ff, 
            emissiveIntensity: 0.5 
        });
        const obstacle = new THREE.Mesh(geo, mat);
        obstacle.position.set(LANES[laneIdx], 0.6, -50);
        sceneRef.current?.add(obstacle);
        obstaclesRef.current.push(obstacle);
    };

    const startGame = () => {
        setGameState("playing");
        animate();
    };

    const animate = () => {
        if (gameState === "gameOver") return;

        // Increase speed
        speed.current += SPEED_INC;

        // Player movement smooth transition
        if (playerRef.current) {
            playerRef.current.position.x += (targetX.current - playerRef.current.position.x) * 0.15;
            playerRef.current.rotation.z = (playerRef.current.position.x - targetX.current) * 0.5;
        }

        // Ground movement (looping effect)
        if (groundRef.current) {
            groundRef.current.position.z += speed.current;
            if (groundRef.current.position.z > 20) groundRef.current.position.z = 0;
        }

        // Obstacles movement and logic
        for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
            const obstacle = obstaclesRef.current[i];
            obstacle.position.z += speed.current;

            // Collision Check
            if (playerRef.current) {
                const dist = playerRef.current.position.distanceTo(obstacle.position);
                if (dist < 1.0) {
                    setGameState("gameOver");
                }
            }

            // Remove off-screen
            if (obstacle.position.z > 10) {
                sceneRef.current?.remove(obstacle);
                obstaclesRef.current.splice(i, 1);
                setScore(s => s + 1);
            }
        }

        // Spawn new obstacle
        if (Math.random() < 0.05 && (obstaclesRef.current.length === 0 || obstaclesRef.current[obstaclesRef.current.length-1].position.z > -30)) {
            spawnObstacle();
        }

        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        frameIdRef.current = requestAnimationFrame(animate);
    };

    const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
        if (gameState !== "playing") return;
        const x = "touches" in e ? e.touches[0].clientX : e.clientX;
        const middle = window.innerWidth / 2;
        
        if (x < middle) {
            // Move Left
            currentLane.current = Math.max(0, currentLane.current - 1);
        } else {
            // Move Right
            currentLane.current = Math.min(2, currentLane.current + 1);
        }
        targetX.current = LANES[currentLane.current];
    };

    return (
        <div 
            className="fixed inset-0 bg-[#050507] flex flex-col items-center justify-center overflow-hidden touch-none"
            ref={containerRef}
            onMouseDown={handleTouch}
            onTouchStart={handleTouch}
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
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Velocity</span>
                    <span className="text-3xl font-black text-cyan-400 italic leading-none">{score}</span>
                </div>
            </div>

            {/* Menus */}
            {(gameState === "idle" || gameState === "gameOver") && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="max-w-md w-full p-10 rounded-[2.5rem] bg-zinc-900/90 border border-white/10 shadow-2xl flex flex-col items-center gap-8 text-center glass">
                        <div className="w-20 h-20 rounded-3xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                            <Rocket className="w-10 h-10 text-cyan-400" />
                        </div>

                        <div>
                            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                                {gameState === "idle" ? "Cyber Runner" : "System Crash"}
                            </h2>
                            <p className="text-zinc-400 mt-2 font-medium">
                                {gameState === "idle" ? "Tap Left or Right side of the screen to change lanes." : "The runner has collided with a data block."}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 w-full gap-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">Distance</span>
                                <span className="text-2xl font-black text-white italic">{score}m</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-zinc-500">Best Sync</span>
                                <span className="text-2xl font-black text-cyan-400 italic">{highScore}m</span>
                            </div>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); gameState === "idle" ? startGame() : setupGame(); }}
                            className="w-full py-5 rounded-2xl bg-cyan-500 text-black font-black uppercase italic tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-3"
                        >
                            {gameState === "idle" ? "Execute" : <><RotateCcw className="w-5 h-5" /> Reboot</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Tap Instruction */}
            {gameState === "playing" && score === 0 && (
                <div className="absolute bottom-20 left-0 right-0 flex justify-around px-10 pointer-events-none animate-pulse">
                    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-500 uppercase">Tap Left</div>
                    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-500 uppercase">Tap Right</div>
                </div>
            )}
        </div>
    );
}
