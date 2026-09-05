/* Boots the real published page in jsdom and checks it renders without errors. */
import { boot, check, done } from "./harness.mjs";
const { d, errors } = await boot();
const q = s => d.querySelectorAll(s);

console.log("boot-smoke");
check("no JS errors on load", errors.length, 0);
if (errors.length) errors.slice(0, 5).forEach(e => console.log("        " + e.slice(0, 200)));
check("specimen cards rendered", q("#shopGrid .plate").length, 618);
check("catalogue plates (no cast)", q("#shopGrid .vit.card svg.spec-plate").length, 528);
check("cast images", q("#shopGrid .vit img").length, 90);
check("plates + casts == catalogue", q("#shopGrid .vit.card svg.spec-plate").length + q("#shopGrid .vit img").length, 618);
check("era tiles", q("#eraTrack .era").length, 5);
check("shelf slots", q("#shelfGrid .vit").length, 5);
check("ledger day groups", q("#recentList .day-group").length > 0);
check("ledger entries open their movement", q("#recentList .entry-name[data-mv]").length > 0);
check("progression chart drew", d.getElementById("chartSvg").childNodes.length > 2);
check("catalogue hint", d.getElementById("catHint").textContent, "618 of 618 shown");
check("illustrated stat", d.getElementById("illusCount").textContent.replace(/\s+/g, " ").trim(), "90 of 618");

/* every bronze-tagged specimen must actually carry a cast, not a plate */
const bronze = [...q("#shopGrid .plate")].filter(c => c.querySelector(".cast-tag.bronze"));
check("bronze-tagged cards", bronze.length, 13);
check("bronze cards all carry a real cast", bronze.filter(c => c.querySelector("svg.spec-plate")).length, 0);

/* no plate may render a hole */
const holes = [...q("#shopGrid svg.spec-plate")].filter(s => /undefined|NaN/.test(s.outerHTML));
check("plates with undefined/NaN fields", holes.length, 0);

done("boot-smoke");
