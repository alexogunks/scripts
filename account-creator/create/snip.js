import { create } from "domain";
import fs from "fs";

try {
  fs.appendFileSync("./test.txt", "Hello, world!\n", { encoding: "utf8", flag: "a" });
  console.log("Successfully wrote to test.txt");
} catch (error) {
  console.error("Error writing test file:", error);
}

cd testing/account-creator/create
node multi.js


