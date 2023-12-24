import fs from 'fs';
import { MongoClient } from "mongodb";

async function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading JSON file:", err);
        throw err;
    }
}

async function run() {
    let ved = await readJsonFile("./data/gallery.json");

    // Add the 'likes' field to each object in the ved array
    ved = ved.map(item => ({ ...item, likes: 0 }));
    ved = ved.map(item => ({ ...item, Comment: [] }));

    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/";
    const client = new MongoClient(uri);

    try {
        await client.connect();

        const database = client.db("ArtGalery");
        const userInfoCollection = database.collection("posts");
        const userLogin = database.collection("UserInfo");
        const ArtistInfo = database.collection("ArtistInfo");
        await userLogin.drop();
        await ArtistInfo.drop();
        await userInfoCollection.drop();
        console.log("All collection has been dropped.");

        // Create a new array to hold the artist info
        

        // Iterate over the ved array and add the artist name and artwork to the new array

        // Insert the new array into the ArtistInfo collection
        const result = await userInfoCollection.insertMany(ved);
        console.log("Successfully inserted " + result.insertedCount + " posts.");
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run().catch(console.error);
