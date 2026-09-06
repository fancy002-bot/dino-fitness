/* Drives the page: sheets, buying, the display shelf, filters and search. */
import { boot, check, done } from "./harness.mjs";
const { d, w, lb, click, errors } = await boot({ hooks: true });
const q = s => d.querySelectorAll(s);

console.log("boot-interactions");

/* --- specimen sheet for an uncast species --- */
click(d.querySelector('#shopGrid .plate[data-id="carcharodontosaurus"]'));
const sh = d.getElementById("sheetInner");
check("sheet opens", d.getElementById("dinoSheet").classList.contains("show"));
check("sheet names the specimen", sh.querySelector(".sheet-name").textContent, "Carcharodontosaurus");
check("uncast sheet shows a catalogue plate", !!sh.querySelector("svg.spec-plate"));
check("uncast sheet subtitle", /Catalogue plate/.test(sh.querySelector(".sheet-no").textContent));

/* --- an owned uncast specimen can be displayed on the shelf (regression) --- */
lb.state.rewards.erasUnlocked = lb.ERAS.map(e => e.id);
lb.state.rewards.tokens = 99999;
lb.renderAll();
click(d.querySelector('#shopGrid .plate[data-id="carcharodontosaurus"] .dino-buy-btn'));
check("buying adds to the collection", lb.state.rewards.owned.includes("carcharodontosaurus"));
lb.toggleShelf("carcharodontosaurus");
const slot = d.querySelector("#shelfGrid .vit");
check("shelf holds the uncast specimen", !!slot.querySelector("svg.spec-plate"));
check("vacant slots", q("#shelfGrid .vit.empty").length, 4);
click(slot);
check("shelf click reopens its sheet", d.getElementById("sheetInner").querySelector(".sheet-name").textContent, "Carcharodontosaurus");

/* --- filters --- */
const chip = label => [...q("#filterChips .filter-chip")].find(b => b.textContent.startsWith(label));
/* All 618 cards now stay in the DOM and filtering toggles `hidden`, so a filter
   costs nothing - the assertions count what is SHOWN, not what exists. */
const shownImgs = () => [...q("#shopGrid .plate")].filter(c => !c.hidden)
  .reduce((n, c) => n + c.querySelectorAll(".vit img").length, 0);
const shownCards = () => [...q("#shopGrid .plate")].filter(c => !c.hidden)
  .reduce((n, c) => n + c.querySelectorAll(".vit.card svg.spec-plate").length, 0);
check("Uncast chip exists", !!chip("Uncast"));
click(chip("Uncast"));
check("every card is kept, not rebuilt", q("#shopGrid .plate").length, 618);
check("Uncast shows only plates", shownImgs(), 0);
check("Uncast count", d.getElementById("catHint").textContent, "528 of 618 shown");
click(chip("Illustrated"));
check("Illustrated shows only casts", shownCards(), 0);
check("Illustrated count", d.getElementById("catHint").textContent, "90 of 618 shown");
click(chip("All"));

/* --- debounced search --- */
const search = async term => {
  d.getElementById("shopSearch").value = term;
  d.getElementById("shopSearch").dispatchEvent(new w.Event("input", { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  return d.getElementById("catHint").textContent;
};
check("search matches diet", await search("shellfish"), "3 of 618 shown");
check("search matches period", (await search("triassic")).endsWith("of 618 shown"));
check("search narrows results", Number((await search("triassic")).split(" ")[0]) < 618);
check("clearing search restores all", await search(""), "618 of 618 shown");

check("no JS errors throughout", errors.length, 0);
if (errors.length) errors.slice(0, 5).forEach(e => console.log("        " + e.slice(0, 200)));
done("boot-interactions");
