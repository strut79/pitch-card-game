import { db } from './firebase.js';
import { collection, doc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export const createGame = async (gameData) => {
    const newGameRef = doc(collection(db, "games"));
    await setDoc(newGameRef, gameData);
    return newGameRef.id;
};

export const onGameUpdate = (gameId, callback) => {
    const gameRef = doc(db, "games", gameId);
    return onSnapshot(gameRef, (doc) => {
        callback(doc.data());
    });
};

export const updateGame = async (gameId, gameData) => {
    const gameRef = doc(db, "games", gameId);
    await updateDoc(gameRef, gameData);
};