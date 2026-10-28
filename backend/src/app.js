import express from "express";
import {createServer} from "node:http";
import {Server} from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import {connectToSocket} from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";
const app= express();
//createServer connect socket server and express instance

const server= createServer(app);
const io= connectToSocket(server);
app.set("port", (process.env.PORT || 8000));

app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit:"40kb", extended: true }));
app.use("/api/v1/users", userRoutes);




const start= async ()=>{
    const connectionDb= await mongoose.connect("mongodb+srv://sanjeebhtc728_db_user:JTYpRYRTX8b3th4I@cluster0.gjmcwxi.mongodb.net/")
    console.log(`mongodb connected to db host: ${connectionDb.connection.host}`)
    server.listen(app.get("port"),()=>{
    console.log("server is listening to port 8000")
});
}
start();
