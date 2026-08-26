import { adminAuth } from "./apps/web/src/lib/firebase.admin";

async function checkUser() {
  try {
    const user = await adminAuth().getUserByEmail("zerayakkabi@gmail.com");
    console.log("User found:", user.uid);
  } catch (error) {
    console.log("Error finding user:", error);
  }
}

checkUser();
