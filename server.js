import express from 'express';
const app = express();
import session from 'express-session';
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import { log } from 'console';
const uri = "mongodb://localhost:27017/";
const client = new MongoClient(uri);
import axios from 'axios';



app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: "some secret here", 
    resave: true, 
    saveUninitialized: true
}));
let db;

async function run() {
    const uri = 'mongodb://localhost:27017';
    const client = new MongoClient(uri);

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        db = client.db("ArtGalery");
    } catch (err) {
        console.error('An error occurred:', err);
    }
}

run();
app.post("/login", async (req, res) => {
    if (req.session.loggedin) {
        return res.sendStatus(400);
    }

    let user= req.body.username;
    let pass = req.body.password;
    let userInfoCollection = db.collection("UserInfo");
    let userFound = await userInfoCollection.find({username: user}).toArray();
    if(userFound.length != 0){
        
        if(userFound[0].password == pass){
            req.session.username = user; //we keep track of what user this session belongs to
            req.session.loggedin = true;

            if(userFound[0].patron === false){
                return res.status(300).json({user:user});
            }
            return res.status(200).json({user:user});
        }else{
            return res.sendStatus(401);
        }
    }else{
        
        return res.status(201).json({user:user});
    }
});
app.post("/register", async (req, res) => {
    if (req.session.loggedin) {
        return res.sendStatus(400);
    }

    let user= req.body.username;
    let pass = req.body.password;
    let userInfoCollection = db.collection("UserInfo");
    let userFound = await userInfoCollection.find({username: user}).toArray();
    if(userFound.length != 0){
        return res.sendStatus(401);
        
    }else{
        let artistInfoCollection = db.collection("ArtistInfo");
        let artist = await artistInfoCollection.findOne({ Artist: user });

        // Check the posts database for the artist's posts
        let postsCollection = db.collection("posts");
        let posts = await postsCollection.find({ Artist: user }).toArray();

        let isArtist = posts.length > 0;

        if (!artist && isArtist) {
            // If the artist does not exist in ArtistInfo but exists in posts, insert the artist
            artist = {
                Artist: user,
                ArtWork: posts.map(post => post.Poster),
                workShops:{}

            };
            await artistInfoCollection.insertOne(artist);
        }else {
            artist = {
                Artist: user,
                ArtWork: [],
                workShops:{}
            };
            await artistInfoCollection.insertOne(artist);
        }

        let userInput = {
            username : user,
            password : pass,
            FollowingArtist:[],
            LikedPostTitle:[],
            commentedTitle:[],
            UserNotification:[],
            comment:{},
            workShop:[],
            search:[],
            patron: !isArtist // Set patron to false if the user is an artist
        }
        req.session.username = user; //we keep track of what user this session belongs to
        const result = await userInfoCollection.insertOne(userInput);

        if(userInput.patron === false){
            return res.status(300).json({user:user});
        }
        return res.status(200).json({user:user});
    }
});



app.get('/home.css', (req, res) => {
    fs.readFile('views/userpages/home.css', 'utf8', (err, data) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while reading the file.');
          return;
        }
        res.type('text/css');
        res.status(200).send(data);
    });
});

app.get('/gallery',async(req,res)=>{
    let postcollection = db.collection("posts");
    let user = db.collection("UserInfo");
    let allPost = await postcollection.find().toArray();
    let userInfo = await user.find({username:req.session.username}).toArray();
    let alldata= {
        posts:allPost,
        user:userInfo[0]
    }
    return res.render('userpages/homepage',{alldata:alldata});
});
app.get('/login/user.css', (req, res) => {
    fs.readFile('views/userpages/user.css', 'utf8', (err, data) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while reading the file.');
          return;
        }
        res.type('text/css');
        res.status(200).send(data);
    });
});

app.get('/login/:user', async (req, res) => {
    let postcollection = db.collection("posts");
    let user = db.collection("UserInfo");
    let userInfo = await user.find({username: req.session.username}).toArray();
    let allPost = [];
    let likedPost = [];
    let commentedPost = [];
    if (userInfo[0].FollowingArtist) {
        allPost = await postcollection.find({Artist: {$in: userInfo[0].FollowingArtist}}).toArray();
    }
    if (userInfo[0].LikedPostTitle) {
        likedPost = await postcollection.find({Title: {$in: userInfo[0].LikedPostTitle}}).toArray();
    }
    if (userInfo[0].commentedTitle) {
        commentedPost = await postcollection.find({Title: {$in: userInfo[0].commentedTitle}}).toArray();
    }
    let alldata = {
        posts: allPost,
        likedPost: likedPost,
        commentedPost:commentedPost,
        user: userInfo[0]
    }
    return res.render('userpages/user', {alldata: alldata});
});
app.get('/addPost',function (req, res){
    res.render('userpages/addApost');
})
app.post('/switch', async(req, res) =>{
    let user = db.collection("UserInfo");
    let artistInfoCollection = db.collection("ArtistInfo");
    let artist = await artistInfoCollection.findOne({ Artist: req.session.username });

    // First, find the user
    user.findOne({ username: req.session.username })
    .then(userInfo => {
        // Check if the artist's artwork is empty
        if (artist && artist.ArtWork.length === 0) {
            return res.status(201).json({message: "Artist's artwork is empty"});
        } else {

            let newPatronValue = !userInfo.patron;

            // Update the 'patron' field in the database
            return user.updateOne(
                { username: req.session.username }, 
                { $set: { patron: newPatronValue } }
            )
            .then(result => {
                return artistInfoCollection.findOne({ Artist: req.session.username })
                .then(artist => {
                    // Send the response
                    res.status(200).json({user: req.session.username});
                });    
            });
        }
    });
});
app.get('/artistprofile/artistUser.css', (req, res) => {
    fs.readFile('views/userpages/artistUser.css', 'utf8', (err, data) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while reading the file.');
          return;
        }
        res.type('text/css');
        res.status(200).send(data);
    });
});

app.get('/artistprofile/:user',async (req, res) =>{
    let postcollection = db.collection("posts");
    let user = db.collection("UserInfo");
    
    let userInfo = await user.find({username: req.session.username}).toArray();
    let allPost = [];
    allPost = await postcollection.find({Artist:req.session.username}).toArray();
    let likedPost = [];
    let followingPost = [];
    let commentedPost = [];
    if (userInfo[0].FollowingArtist) {
        followingPost = await postcollection.find({Artist: {$in: userInfo[0].FollowingArtist}}).toArray();
    }

    if (userInfo[0].LikedPostTitle) {
        likedPost = await postcollection.find({Title: {$in: userInfo[0].LikedPostTitle}}).toArray();
    }
    if (userInfo[0].commentedTitle) {
        commentedPost = await postcollection.find({Title: {$in: userInfo[0].commentedTitle}}).toArray();
    }
    let alldata = {
        posts: allPost,
        followingPost:followingPost,
        likedPost: likedPost,
        commentedPost:commentedPost,
        user: userInfo[0]
    }
    return res.render('userpages/artistUserpage', {alldata: alldata});
});
app.get('/art/:artist/artwork.css', (req, res) => {
    fs.readFile('views/userpages/artwork.css', 'utf8', (err, data) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while reading the file.');
          return;
        }
        res.type('text/css');
        res.status(200).send(data);
    });
});

app.get('/artist/artist.css', (req, res) => {
    fs.readFile('views/userpages/artist.css', 'utf8', (err, data) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while reading the file.');
          return;
        }
        res.type('text/css');
        res.status(200).send(data);
    });
});
app.get('/', (req, res) => {
    res.render('userpages/login');
});
app.get('/artist/:artist',async(req,res)=>{
    let artist = req.params.artist;
    let postcollection = db.collection("posts");
    let usercollection = db.collection("UserInfo");
    let ArtistCollection = db.collection("ArtistInfo");
    let userArtist =  await ArtistCollection.findOne({Artist: req.session.username});
    let allPost = await postcollection.find({Artist: artist}).toArray();

    let alldata = {
        allPost : allPost,
        artist:userArtist,
        user: await usercollection.find({username: req.session.username}).toArray()
    }
    return res.render('userpages/artist',{alldata:alldata});
});


app.post("/logout",async (req, res)=>{
    if (req.session.loggedin) {
        req.session.loggedin = false;
		req.session.username = undefined;
        res.status(200).send("Logged out.");
    }
});


app.post('/send', async (req, res) => {
    let post = req.body;
    post.Artist = req.session.username;
    if (post.Title && post.Year && post.Category && post.Medium && post.Description && post.Poster) {

        // Check if the image URL is valid
        try {
            await axios.head(post.Poster);
        } catch (error) {
            return res.status(401).send('Invalid image URL');
        }

        let collection = db.collection("posts");

        // Check if a post with the same title already exists
        let existingPost = await collection.findOne({Title: post.Title});
        if (existingPost) {
            return res.status(402).send('A post with this title already exists');
        }

        await collection.insertOne(post);
        let ArtistCollection = db.collection("ArtistInfo");
        let Usercollection = db.collection("UserInfo");

        let Artist = await ArtistCollection.findOne({Artist: req.session.username});
        if (Artist) {
            // If the artist exists, add the new artwork to the ArtWork array

            await ArtistCollection.updateOne(
                {Artist: req.session.username},
                {$push: {ArtWork: post.Poster}}
            )
            let followers = await Usercollection.find({FollowingArtist: {$in: [req.session.username]}}).toArray();

            // For each follower, push a notification to their UserNotification array
        
            let timestamp = new Date().toISOString();

    // For each follower, push a notification with a timestamp to their UserNotification array
            for (let follower of followers) {
                let notification = req.session.username + " has a new post!! " + " at " + timestamp;
                await Usercollection.updateOne({username: follower.username}, {$push: {UserNotification: notification}});
            }
            
            await Usercollection.updateOne(
                {username: req.session.username},
                {$set: {patron:false}}
            )
            
            res.status(200).send('Post received');
        }
    } else {
        res.status(400).send('Please fill all fields');
    }
});

app.post('/follow', async (req, res) => {
    let Artist = req.body.Artist;
    let usercollection = db.collection("UserInfo");
    await usercollection.find({username: req.session.username}).toArray()
    if (Artist) {
        // If the artist exists, add the new artwork to the ArtWork array
        await usercollection.updateOne(
            {username: req.session.username},
            {$addToSet: {FollowingArtist: Artist}}
        )
        res.status(200).send('Follow successful');
    } else {
        res.status(400).send('Artist not provided');
    }
});
app.post('/unfollow', async (req, res) => {
    let Artist = req.body.Artist;
    let usercollection = db.collection("UserInfo");
    await usercollection.find({username: req.session.username}).toArray()
    if (Artist) {
        // If the artist exists, add the new artwork to the ArtWork array
        await usercollection.updateOne(
            {username: req.session.username},
            {$pull: {FollowingArtist: Artist}}
        )
        res.status(200).send('unFollow successful');
    } else {
        res.status(400).send('Artist not provided');
    }
});

app.get('/art/:artist/:artwork', async(req, res) => {
    const artist = req.params.artist;
    const work = req.params.artwork;
    const artCollection = db.collection("posts");
    const userCollection = db.collection("UserInfo");
    try{
        const data = await artCollection.findOne({"Artist": artist, "Title": work});
        const user = await userCollection.findOne({username:req.session.username});
        let alldata = {
            'userinfo': user,
            'artdata' : data,
        }
        res.render('userpages/artwork',{alldata:alldata});
    }catch{
        return res.status(404).send('Not Found')
    }

});
app.put('/like', async (req, res) => {
    
    let Artist = req.body.Artist;
    let Artwork = req.body.Artwork;
    let usercollection = db.collection("UserInfo");
    let postcollection = db.collection("posts");
    await usercollection.find({username: req.session.username}).toArray()
    if (Artist) {
        // If the artist exists, add the new artwork to the ArtWork array
        await usercollection.updateOne(
            {username: req.session.username},
            {$addToSet: {LikedPostTitle: Artwork}}
        );
        postcollection.updateOne({Artist: Artist, Title: Artwork}, {$inc: {likes: 1}})
    
        res.status(200).send('Liked successful');
    } else {
        res.status(400).send('Artist not provided');
    }
});

app.put('/unlike', async (req, res) => {
    let Artist = req.body.Artist;
    let Artwork = req.body.Artwork;
    let usercollection = db.collection("UserInfo");
    let postcollection = db.collection("posts");
    await usercollection.find({username: req.session.username}).toArray()
    if (Artist) {
        // If the artist exists, add the new artwork to the ArtWork array
        await usercollection.updateOne(
            {username: req.session.username},
            {$pull: {LikedPostTitle: Artwork}}
        );
        postcollection.updateOne({Artist: Artist, Title: Artwork}, {$inc: {likes: -1}})
    
        res.status(200).send('Liked successful');
    } else {
        res.status(400).send('Artist not provided');
    }

});



app.put('/comment/:artwork', async (req, res) => {
    let art = req.params.artwork;
    let comment = req.body.comment; // Get the comment from the request body
    let post = db.collection("posts");
    let user = db.collection("UserInfo");

    // Find the user and check if they have already liked the artwork
    let foundUser = await user.findOne({username: req.session.username});
    await user.updateOne(
            {username: req.session.username},
            {$push: {commentedTitle: art}}
        )
    post.updateOne({Title: art}, {$push: {Comment: comment}})
    .then(async result => {
        // If the key does not exist in the comment object or its value is not an array, initialize it as an array
        if (!foundUser.comment[art] || !Array.isArray(foundUser.comment[art])) {
            foundUser.comment[art] = [];
        }

        // Push the comment into the array at the specified key
        foundUser.comment[art].push(comment);

        // Update the user's document in the UserInfo collection
        await user.updateOne({username: req.session.username}, {$set: {["comment." + art]: foundUser.comment[art]}});
        
        res.status(200).send('Update successful');
    })
    .catch(err => {
        res.status(500).send('An error occurred');
    });
});
app.delete('/deleteComment/:artwork', async (req, res) => {
    let art = req.params.artwork;
    let comment = req.body.comment; // Get the comment from the request body
    let post = db.collection("posts");
    let user = db.collection("UserInfo");

    // Find the user
    let foundUser = await user.findOne({username: req.session.username});
    
    // Check if the comment exists in the user's comment object
    if (foundUser.comment[art] && foundUser.comment[art].includes(comment)) {
        await user.updateOne(
            {username: req.session.username},
            {$pull: {commentedTitle: art}}
        )
        // If the comment exists, remove it from the Comment array in the posts collection
        post.updateOne({Title: art}, {$pull: {Comment: comment}})
        .then(async result => {
            // Remove the comment from the array at the specified key in the user's comment object
            const index = foundUser.comment[art].indexOf(comment);
            if (index > -1) {
                foundUser.comment[art].splice(index, 1);
            }

            // Update the user's document in the UserInfo collection
            await user.updateOne({username: req.session.username}, {$set: {["comment." + art]: foundUser.comment[art]}});
            
            res.status(200).send('Update successful');
        })
        .catch(err => {
            res.status(500).send('An error occurred');
        });
    } else {
        // If the comment does not exist, do not attempt to delete it
        res.status(400).send('The comment you are trying to delete does not exist');
    }
});

app.get('/logout', (req, res) => {
    res.render('userpages/logout');
});

app.get('/img/artgallery.jpg', (req, res) => {
    fs.readFile('views/userpages/img/artgallery.jpg', (err, data) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while reading the file.');
          return;
        }
        res.type('image/jpg');
        res.send(data);
    });
});

app.get('/search', async(req, res) => {
    let postcollection = db.collection("posts");
    let user = db.collection("UserInfo");
    let allPost = await postcollection.find().toArray();
    let userInfo = await user.find({username:req.session.username}).toArray();
    let alldata= {
        posts:allPost,
        user:userInfo[0]
    }
    res.render('userpages/search',{alldata:alldata});
});
app.put('/search', async(req, res) => {
    try {
        // Extract fields from request body
        const { Title, Artist, Year, Category, Medium, Description, Poster } = req.body;

        // Build the query object based on the fields provided
        let query = {};
        if (Title) query.Title = {$regex: new RegExp(`^${Title}$`, 'i')};
        if (Artist) query.Artist = {$regex: new RegExp(`^${Artist}$`, 'i')};
        if (Year) query.Year = {$regex: new RegExp(`^${Year}$`, 'i')};
        if (Category) query.Category = {$regex: new RegExp(`^${Medium}$`, 'i')};
        if (Medium) query.Medium = {$regex: new RegExp(`^${Medium}$`, 'i')};
        if (Description) query.Description = {$regex: new RegExp(`^${Description}$`, 'i')};
        if (Poster) query.Poster = {$regex: new RegExp(`^${Poster}$`, 'i')};

        // Query the 'post' collection
        const results = await db.collection('posts').find(query).toArray();

        // Get the current user
        const username = req.session.username;
        const user = await db.collection('UserInfo').findOne({ username });

        // Clear the search array
        user.search = [];

        // Add the found posts to the search array
        user.search.push(...results);

        // Update the user document
        await db.collection('UserInfo').updateOne({ username }, { $set: { search: user.search } });

        // Send the found posts as the response
        res.json(results);
    } catch (error) {
        // If an error occurred, send a 500 response with the error message
        res.status(500).send(`An error occurred: ${error.message}`);
    }
});




app.get('/workshop/:artist', async(req, res) => {
    let artist = req.params.artist;
    let Artistcollection = db.collection("ArtistInfo");
    let user = db.collection("UserInfo");
    let allPost = await Artistcollection.find({Artist:artist}).toArray();
    let alldata;
    if(artist == req.session.username){
        alldata= {
            workShops:allPost,
            artist:true
        }
    }else{
        alldata= {
            workShops:allPost,
            artist:false
        }
    }
    res.render('userpages/workshop',{alldata:alldata});
});
app.get('/WorkshopCreation/:artist', async(req, res) => {
    let artist = req.params.artist;
    let Artistcollection = db.collection("ArtistInfo");
    let user = db.collection("UserInfo");
    let allPost = await Artistcollection.find({Artist:artist}).toArray();
    let alldata;
    if(artist == req.session.username){
        alldata= {
            workShops:allPost,
            artist:true
        }
    }else{
        alldata= {
            workShops:allPost,
            artist:false
        }
    }
    res.render('userpages/WorkshopCreation',{alldata:alldata});
});
app.put('/WorkshopCreation/:artist', async(req, res) => {
    let artist = req.params.artist;
    let name = req.body.workshopName;
    let description = req.body.description;
    let Artistcollection = db.collection("ArtistInfo");
    let Usercollection = db.collection("UserInfo");

    // Create the update query
    let updateQuery = {};
    updateQuery[`workShops.${name}`] = {
        description:description,
        users:[]
    };

    // Update the document
    let result = await Artistcollection.updateOne({Artist: artist}, {$set: updateQuery});

    // Find all users who follow the artist
    let followers = await Usercollection.find({FollowingArtist: {$in: [artist]}}).toArray();

    // Get the current date and time
    let timestamp = new Date().toISOString();

    // For each follower, push a notification with a timestamp to their UserNotification array
    for (let follower of followers) {
        let notification = "This is new created workshop " + name + " by " + artist + " at " + timestamp;
        await Usercollection.updateOne({username: follower.username}, {$push: {UserNotification: notification}});
    }
    res.status(200).send("You have been successful");
});

app.put('/joinWorkshop/:artist', async(req, res) => {
    let artist = req.params.artist;
    let name = req.body.workshopName;
    let Usercollection = db.collection("UserInfo");

    let artistInfo = db.collection("ArtistInfo");
    let cuArtist = await artistInfo.findOne({Artist: artist});

    if (cuArtist) {
        // If the artist exists, update the workshop
        let updateQuery = {};
        updateQuery[`workShops.${name}.users`] = req.session.username;

        await artistInfo.updateOne(
            {Artist: artist},
            {$push: updateQuery}
        );
    }
    let user = await Usercollection.findOne({username: req.session.username});

    // Check if the user has already joined the workshop
    if (user.workShop.includes(name)) {
        res.status(400).send('You have already joined this workshop');
        return;
    }

    // If not, add the workshop to the user's workshops
    let result = await Usercollection.updateOne({username: req.session.username}, {$push:{workShop:name}});

    res.status(200).send('Successfully joined the workshop');
});
app.get('/notification', async(req, res) => {
    let Usercollection = db.collection("UserInfo");

    // Find the current user
    let currentUser = await Usercollection.findOne({username: req.session.username});
    let allInfo = {
        username: req.session.username,
        notification: currentUser.UserNotification
    }
    // Render the notifications page with the current user's data
    res.render('userpages/notification', {user: allInfo});
});

app.get('/client.js', (req, res) => {
    fs.readFile('views/userpages/client.js', 'utf8', (err, data) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while reading the file.');
          return;
        }
        res.type('.js');
        res.status(200).send(data);
    });

});
app.get('/style.css', (req, res) => {
    fs.readFile('views/userpages/style.css', 'utf8', (err, data) => {
        if (err) {
          console.error(err);
          res.status(500).send('An error occurred while reading the file.');
          return;
        }
        res.type('text/css');
        res.status(200).send(data);
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
    console.log('Server running at http://localhost:3000/');
});