import { boot } from "./harness.mjs";
const { lb, db, w, errors, tick } = await boot({ hooks:true, db:true });
console.log("db present:", !!db, "dbAvailable:", lb.state.dbAvailable);
console.log("me:", lb.me);
await tick(4);
console.log("subs after boot:", db.__subCount());
console.log("errors:", errors.slice(0,5));
