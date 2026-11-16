import { Globe2, ArrowUpRight } from "lucide-react"
import styles from "./landing.module.css"

const socialAccounts = [
  "Facebook",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "TikTok",
  "Google",
]

const footerPages = ["About Converyn", "Services", "Insights", "Contact"]

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerColumns}>
          <div className={styles.footerBrand}>
            <p className={styles.brandName}>converyn</p>
            <p>
              Creative thinking. Connected expertise. Digital services that help
              bring your next idea into focus.
            </p>
          </div>

          <div className={styles.footerLinks}>
            <h2>Find us online</h2>
            <ul>
              {socialAccounts.map((account) => (
                <li key={account}>
                  <span className={styles.footerItem}>
                    {account}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footerLinks}>
            <h2>Explore Converyn</h2>
            <ul>
              {footerPages.map((page) => (
                <li key={page}>
                  <span className={styles.footerItem}>
                    {page}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footerLegal}>
            <h2>A note on ownership</h2>
            <p>
              All content, imagery, and third-party trademarks belong to their
              respective owners. Their use does not imply ownership,
              endorsement, sponsorship, or affiliation.
            </p>
            <span className={styles.footerTerms}>
              Terms &amp; Privacy
              <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>
            &copy; {new Date().getFullYear()} Converyn. All rights reserved.
          </span>
          <span className={styles.footerLocation}>
            <Globe2 size={14} aria-hidden="true" /> Based in the Philippines.
          </span>
        </div>
      </div>
    </footer>
  )
}
