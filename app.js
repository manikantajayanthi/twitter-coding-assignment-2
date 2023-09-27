const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
let db = null;
const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("This server is running on http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUser = `
        INSERT 
        INTO 
        user (username, password, name, gender) 
        VALUES 
        ('${username}', '${hashedPassword}', '${name}', '${gender}');`;
      const newUser = await db.run(createUser);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUser = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUSer = await db.get(getUser);
  if (dbUSer !== undefined) {
    const comparePassword = await bcrypt.compare(password, dbUSer.password);
    if (comparePassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

const authorizationToken = async (request, response, next) => {
  let jwtToken;
  const autHeader = request.headers["authorization"];
  if (autHeader !== undefined) {
    jwtToken = autHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/", authorizationToken, async (request, response) => {
  const { username } = request;
  const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUser);
  console.log(dbUser);
  const getUserFollowing = `SELECT
      following_user_id
    FROM
      follower
    WHERE
      follower_user_id = ${dbUser.user_id};`;
  const getFollowingIds = await db.all(getUserFollowing);
  const individualID = getFollowingIds.map((eachID) => {
    return eachID.following_user_id;
  });
  const getTweetQuery = `SELECT user.username, tweet.tweet, date_time AS dateTime FROM
   user INNER JOIN tweet ON user.user_id = tweet.user_id where user.user_id IN
    (${individualID}) ORDER BY tweet.date_time DESC LIMIT 4;`;
  const tweets = await db.all(getTweetQuery);
  response.send(tweets);
});

app.get("/user/following/", authorizationToken, async (request, response) => {
  const { username } = request;
  const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUser);
  console.log(dbUser);
  const getUserFollowing = `SELECT
      following_user_id
    FROM
      follower
    WHERE
      follower_user_id = ${dbUser.user_id};`;
  const getFollowingIds = await db.all(getUserFollowing);
  const individualID = getFollowingIds.map((eachID) => {
    return eachID.following_user_id;
  });
  const getTweetQuery = `SELECT name FROM user where user.user_id IN
    (${individualID});`;
  const followingNames = await db.all(getTweetQuery);
  response.send(followingNames);
});

app.get("/user/followers/", authorizationToken, async (request, response) => {
  const { username } = request;
  const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUser);
  console.log(dbUser);
  const getUserFollowing = `SELECT
      follower_user_id
    FROM
      follower
    WHERE
      following_user_id = ${dbUser.user_id};`;
  const getFollowingIds = await db.all(getUserFollowing);
  const individualID = getFollowingIds.map((eachID) => {
    return eachID.follower_user_id;
  });
  console.log(`${getFollowingIds}`);
  const getTweetQuery = `SELECT name FROM user where user_id IN
    (${individualID});`;
  const followingNames = await db.all(getTweetQuery);
  response.send(followingNames);
});

const dataRequested = (tweetInfo, totalLikes, totalReplies) => {
  return {
    tweet: tweetInfo.tweet,
    likes: totalLikes.likes,
    replies: totalReplies.replies,
    dateTime: tweetInfo.dateTime,
  };
};

app.get("/tweets/:tweetId/", authorizationToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUser);
  console.log(dbUser);
  const getUserFollowing = `SELECT
      following_user_id
    FROM
      follower
    WHERE
      follower_user_id = ${dbUser.user_id};`;
  const getFollowingIds = await db.all(getUserFollowing);
  const individualID = getFollowingIds.map((eachID) => {
    return eachID.following_user_id;
  });
  const getTweetId = `SELECT tweet_id FROM tweet WHERE user_id IN (${individualID});`;
  const tweetIDs = await db.all(getTweetId);
  const singleTweetId = tweetIDs.map((eachTweet) => {
    return eachTweet.tweet_id;
  });
  console.log(singleTweetId);
  console.log(tweetId);
  console.log(singleTweetId.includes(parseInt(tweetId)));
  if (singleTweetId.includes(parseInt(tweetId))) {
    const getLikeCount = `SELECT COUNT(like_id) as likes
    FROM like WHERE tweet_id = ${parseInt(tweetId)};`;
    const tweetLikes = await db.get(getLikeCount);

    const getReplyCount = `SELECT COUNT(reply_id) as replies
    FROM reply WHERE tweet_id = ${parseInt(tweetId)};`;
    const tweetReplies = await db.get(getReplyCount);

    const getTweetAndDateTime = `SELECT tweet, date_time as dateTime
    FROM tweet WHERE tweet_id = ${parseInt(tweetId)};`;
    const tweetResponse = await db.get(getTweetAndDateTime);

    response.send(dataRequested(tweetResponse, tweetLikes, tweetReplies));
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

const assignLikesObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};
app.get(
  "/tweets/:tweetId/likes/",
  authorizationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    console.log(tweetId);
    const { username } = request;
    const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(getUser);
    console.log(dbUser);
    const getUserFollowing = `SELECT
      follower_user_id
    FROM
      follower
    WHERE
      following_user_id = ${dbUser.user_id};`;
    const getFollowingIds = await db.all(getUserFollowing);
    const individualId = getFollowingIds.map((eachID) => {
      return eachID.follower_user_id;
    });
    const getTweetIds = `SELECT tweet_id FROM tweet WHERE user_id IN (${individualId});`;
    const tweetIdArray = await db.all(getTweetIds);
    console.log(tweetIdArray);
    const tweetIdList = tweetIdArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    if (tweetIdList.includes(parseInt(tweetId))) {
      const getLikeUserId = `SELECT user.username as likes FROM user INNER JOIN like ON
      user.user_id = like.user_id  WHERE like.tweet_id = ${tweetId};`;
      const getLikeUserArray = await db.all(getLikeUserId);
      console.log(getLikeUserArray);
      const getLikeUSerNames = getLikeUserArray.map((eachUser) => {
        return eachUser.likes;
      });
      console.log(getLikeUSerNames);
      response.send(assignLikesObject(getLikeUSerNames));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

const assignRepliesObject = (dbReplyObject) => {
  return {
    replies: dbReplyObject,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authorizationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    console.log(tweetId);
    const { username } = request;
    const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(getUser);
    console.log(dbUser);
    const getUserFollowing = `SELECT
      follower_user_id
    FROM
      follower
    WHERE
      following_user_id = ${dbUser.user_id};`;
    const getFollowingIds = await db.all(getUserFollowing);
    const individualId = getFollowingIds.map((eachID) => {
      return eachID.follower_user_id;
    });
    const getTweetIds = `SELECT tweet_id FROM tweet WHERE user_id IN (${individualId});`;
    const tweetIdArray = await db.all(getTweetIds);
    console.log(tweetIdArray);
    const tweetIdList = tweetIdArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(tweetIdList);
    if (tweetIdList.includes(parseInt(tweetId))) {
      const getRepliesQuery = `SELECT user.name, reply.reply FROM user INNER JOIN
        reply ON user.user_id = reply.user_id WHERE tweet_id = ${tweetId};`;
      const getReply = await db.all(getRepliesQuery);
      response.send(assignRepliesObject(getReply));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", authorizationToken, async (request, response) => {
  const { username } = request;
  const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUser);
  console.log(dbUser);
  const getTweetByUser = `SELECT 
  tweet,
  COUNT(DISTINCT like_id) AS likes,
  COUNT(DISTINCT reply_id) AS replies,
  date_time as dateTime
  FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.reply_id LEFT JOIN
  like on tweet.tweet_id = like.tweet_id WHERE tweet.user_id = ${dbUser.user_id} GROUP BY tweet.tweet_id;`;
  const tweetsByUser = await db.all(getTweetByUser);
  response.send(tweetsByUser);
});

app.post("/user/tweets/", authorizationToken, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request;
  const getUserQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const dateTime = new Date().toJSON().substring(0, 19).replace("T", " ");
  const insertTweetQuery = `INSERT INTO tweet (tweet, user_id, date_time) VALUES('${tweet}', ${dbUser.user_id}, '${dateTime}');`;
  console.log(dateTime);
  const insertTweet = await db.run(insertTweetQuery);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authorizationToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(getUser);
    console.log(dbUser);
    const getTweetIds = `SELECT tweet_id FROM tweet WHERE user_id = ${dbUser.user_id};`;
    const tweetIdArray = await db.all(getTweetIds);
    console.log(tweetIdArray);
    const tweetIdList = tweetIdArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    if (tweetIdList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
