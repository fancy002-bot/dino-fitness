/* The hosted build's register. Both values below are public by design: the
   publishable key identifies the project, it does not authorise anything.
   Row-level security is what protects the data, which is why the policies in
   supabase/migrations/0001_init.sql are the real security boundary and this
   file is not. Never put an sb_secret_ key here. */
window.LOADBOOK_SUPABASE = {
  url: "https://hvlinxqvqhscsynafylx.supabase.co",
  anonKey: "sb_publishable_vi3nvIEY4kPYY6bLLJwvUw_PnO_yI7q"
};
