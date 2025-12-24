import { getStyles } from "@/lib/store";
import { StyleCard } from "@/components/style-card";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";

export default function Explorer() {
  const styles = getStyles();

  return (
    <Layout>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-border pb-4 md:pb-6 gap-4 md:gap-0">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground">Style Vault</h1>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
              A curated library of visual intelligence artifacts. Inspect tokens, compare aesthetics, and analyze prompt scaffolding.
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-muted-foreground flex-shrink-0">
            <span>{styles.length} STYLES INDEXED</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {styles.map((style, index) => (
            <motion.div
              key={style.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
            >
              <StyleCard style={style} />
            </motion.div>
          ))}
        </div>
        
        {styles.length === 0 && (
           <div className="py-20 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/10">
             <p>No styles found in the vault.</p>
           </div>
        )}
      </div>
    </Layout>
  );
}
