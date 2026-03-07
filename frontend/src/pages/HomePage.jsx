import { motion } from "framer-motion";
import { Compass, PlayCircle, Radar } from "lucide-react";

const features = [
  {
    icon: Compass,
    title: "Narrative Navigation",
    description: "Turn one-line ideas into high-retention episodic structures.",
  },
  {
    icon: Radar,
    title: "Intelligence Layer",
    description: "Analyze cliffhanger tension, pacing, and emotional coherence.",
  },
  {
    icon: PlayCircle,
    title: "Creator-Ready Output",
    description: "Ship episode-ready beats with optimization guidance.",
  },
];

export default function HomePage({ onGoDashboard, onGoAnalysis }) {
  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-lg"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">
          Welcome to StoryFlow
        </p>
        <h1 className="mt-3 max-w-4xl bg-gradient-to-r from-cyan-200 via-blue-200 to-purple-200 bg-clip-text text-4xl font-semibold leading-tight text-transparent sm:text-5xl pb-2">
          Turn story ideas into structured, binge-worthy episodic arcs.
        </h1>
        <p className="mt-4 max-w-2xl text-white/75">
          StoryFlow helps creators transform simple ideas into structured episodic story arcs, complete with pacing insights, narrative beats, and audience-driven storytelling guidance.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onGoDashboard}
            className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Start Generating
          </button>
          <button
            type="button"
            onClick={onGoAnalysis}
            className="rounded-xl border border-purple-300/40 bg-purple-300/10 px-5 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-purple-300/20"
          >
            Explore Audience Insights
          </button>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 * index }}
              className="rounded-xl border border-white/10 bg-black/20 p-5 backdrop-blur-lg"
            >
              <Icon className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-white/70">{feature.description}</p>
            </motion.article>
          );
        })}
      </section>
    </div>
  );
}
