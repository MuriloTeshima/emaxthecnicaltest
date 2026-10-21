import { z } from "zod";

// Default validation messages in Spanish, both in the browser and on the server.
z.config(z.locales.es());

export { z };
