"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "sonner";
import { Loader2, User, MapPin, Calendar, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const INTERESTS_LIST = [
    "Technology", "Sports", "Politics", "Gaming", "Music",
    "Movies", "Art", "Science", "Education", "Travel",
    "Fashion", "Food", "Fitness", "Business"
];

interface ProfileEditFormProps {
    initialData: {
        id: string;
        full_name: string;
        username: string;
        bio: string;
        avatar_url: string;
        country?: string;
        age?: number;
        interests?: string[];
    };
    onSuccess?: () => void;
}

export function ProfileEditForm({ initialData, onSuccess }: ProfileEditFormProps) {
    const { supabase } = useAuth();
    const [fullName, setFullName] = useState(initialData.full_name || "");
    const [username, setUsername] = useState(initialData.username || "");
    const [bio, setBio] = useState(initialData.bio || "");
    const [avatarUrl, setAvatarUrl] = useState(initialData.avatar_url || "");
    const [country, setCountry] = useState(initialData.country || "");
    const [age, setAge] = useState(initialData.age?.toString() || "");
    const [interests, setInterests] = useState<string[]>(initialData.interests || []);
    const [loading, setLoading] = useState(false);

    const handleInterestToggle = (interest: string) => {
        if (interests.includes(interest)) {
            setInterests(interests.filter(i => i !== interest));
        } else {
            if (interests.length >= 5) {
                toast.error("You can select up to 5 interests maximum.");
                return;
            }
            setInterests([...interests, interest]);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({
                    full_name: fullName,
                    username: username.toLowerCase().trim(),
                    bio: bio,
                    avatar_url: avatarUrl,
                    country: country.trim(),
                    age: age ? parseInt(age) : null,
                    interests: interests,
                    updated_at: new Date().toISOString()
                })
                .eq("id", initialData.id);

            if (error) throw error;

            // 🔵 Global Profile Sync Trigger (Apinator)
            fetch('/api/apinator/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: `profiles-${initialData.id}`,
                    event: 'profile_updated',
                    data: { id: initialData.id, full_name: fullName, avatar_url: avatarUrl }
                })
            }).catch(console.error);

            toast.success("Profile Chamak Gaya! ✨ (Updated)");
            if (onSuccess) onSuccess();
        } catch (error: any) {
            console.error(error);
            if (error.code === '23505' || error.message?.includes('unique')) {
                toast.error("Yeh username pehle se kisi ne le rakha hai, bhai! Kuch aur try kar.");
            } else {
                toast.error("Kuch gadbad ho gayi: " + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-lg mx-auto p-4 glass-card rounded-2xl border-premium">
            <div className="flex flex-col items-center gap-4 py-4">
                <Avatar className="w-24 h-24 border-4 border-primary/20 ring-4 ring-black/50">
                    <AvatarImage src={avatarUrl} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-zinc-800"><User className="w-12 h-12" /></AvatarFallback>
                </Avatar>

                <div className="w-full max-w-[200px]">
                    <FileUpload
                        onUploadComplete={(urls: string[]) => {
                            if (urls.length > 0) setAvatarUrl(urls[0]);
                        }}
                    />
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1">Poora Naam</label>
                    <Input
                        value={fullName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                        placeholder="Tumhara naam kya hei?"
                        className="bg-black/50 border-white/10 focus:border-primary transition-all rounded-xl"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1">Username</label>
                    <Input
                        value={username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const val = e.target.value.toLowerCase().replace(/\s/g, '');
                            setUsername(val);
                        }}
                        placeholder="Unique username dalo..."
                        className="bg-black/50 border-white/10 focus:border-primary transition-all rounded-xl"
                    />
                    <p className="text-[10px] text-zinc-600 ml-1 italic">Username unique hona chahiye aur spaces nahi chalenge.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1">Apne Baare Mein (Bio)</label>
                    <Textarea
                        value={bio}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
                        placeholder="Kuch toh likho apne baare mein..."
                        className="bg-black/50 border-white/10 focus:border-primary transition-all rounded-xl min-h-[100px] resize-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-orange-400" />
                            Country
                        </label>
                        <Input
                            value={country}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
                            placeholder="e.g. India"
                            className="bg-black/50 border-white/10 focus:border-primary transition-all rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-pink-400" />
                            Age
                        </label>
                        <Input
                            type="number"
                            value={age}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAge(e.target.value)}
                            placeholder="e.g. 21"
                            className="bg-black/50 border-white/10 focus:border-primary transition-all rounded-xl"
                            min="13"
                            max="120"
                        />
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Heart className="w-4 h-4 text-red-400" />
                            Interests
                        </span>
                        <span className="text-xs text-zinc-500 font-normal">{interests.length}/5 selected</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {INTERESTS_LIST.map((interest) => {
                            const isSelected = interests.includes(interest);
                            return (
                                <button
                                    key={interest}
                                    type="button"
                                    onClick={() => handleInterestToggle(interest)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${isSelected
                                        ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20 scale-105'
                                        : 'bg-zinc-800/50 border-white/10 text-zinc-400 hover:border-white/30 hover:bg-zinc-800'
                                        }`}
                                >
                                    {interest}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <Button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl shadow-lg transition-all active:scale-95"
            >
                {loading ? <Loader2 className="animate-spin mr-2" /> : "Save Kar Lo"}
            </Button>
        </div>
    );
}
