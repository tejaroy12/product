const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const cors = require("cors");
const path = require("path");
const fs = require("fs")

const app = express();
app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, "farmers_market.db");

let db;

const initializeDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    console.log("✅ Connected to SQLite database.");

    // Recreate necessary tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS farmers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        gender TEXT NOT NULL,
        location TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        product_name TEXT NOT NULL,
        price REAL NOT NULL,
        number INTEGER NOT NULL,
        delivery TEXT NOT NULL,
        FOREIGN KEY(username) REFERENCES farmers(username) ON DELETE CASCADE
      );
    `);

    console.log("✅ Database tables ensured.");
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    process.exit(1);
  }
};


initializeDB();

// Register User API
app.post("/register", async (req, res) => {
  const { username, name, password, gender, location } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Check if user exists
    const dbUser = await db.get("SELECT * FROM farmers WHERE username = ?", [username]);
    if (dbUser) {
      return res.status(400).json({"msg":"User already exists"});
    }

    // Insert new user
    await db.run(
      `INSERT INTO farmers (username, name, password, gender, location) VALUES (?, ?, ?, ?, ?)`,
      [username, name, hashedPassword, gender, location]
    );

    res.send("User created successfully");
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({"msg":"Internal Server Error"});
  }
});

// User Login API
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user exists
    const dbUser = await db.get("SELECT * FROM farmers WHERE username = ?", [username]);

    if (!dbUser) {
      return res.status(400).send("Invalid User");
    }

    // Validate password
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (!isPasswordMatched) {
      return res.status(400).json({"msg":"Invalid Password"});
    }

    // Generate JWT Token
    const payload = { username };
    const jwtToken = jwt.sign(payload, "yugrfvcbdksbjj", { expiresIn: "1h" });

    res.json({"jwt_token": jwtToken });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).send("Internal Server Error");
  }
});


//update

app.put("/update", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Hash the new password before storing it
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Use a parameterized query to prevent SQL injection
    const sql = `UPDATE farmers SET password = ? WHERE username = ?`;
    const result = await db.run(sql, [hashedPassword, username]);

    // Check if any row was updated
    if (result.changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/check-db", async (req, res) => {
  try {
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table';");
    res.json({ success: true, tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


//add products 


app.post("/products", async (req, res) => {
  try {
    const { username, product_name, price, number ,delivery} = req.body;

    if (!username || !product_name || !price || !number) {
      return res.status(400).json({ error: "All fields are required" });
    }


    // Check if the user exists
    const user = await db.get(`SELECT * FROM farmers WHERE username = ?`, [username]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Insert product into database
    const insertSql = `INSERT INTO products (username, product_name, price, number,delivery) VALUES (?, ?, ?, ?,?)`;
    await db.run(insertSql, [username, product_name, price, number,delivery]);

    res.status(201).json({ message: "Product added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


//products update


app.put("/products/update", async (req, res) => {
  try {
    const { username, product_name, price, number, delivery } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    // Check if any products exist for this username
    const product = await db.get("SELECT * FROM products WHERE username = ?", [username]);
    if (!product) {
      return res.status(404).json({ error: "No product found for this user" });
    }

    // Update only provided fields while keeping existing values
    const updatedProduct = {
      product_name: product_name || product.product_name,
      price: price || product.price,
      number: number || product.number,
      delivery: delivery || product.delivery,
    };

    const sql = `UPDATE products
                 SET product_name = ?, price = ?, number = ?, delivery = ?
                 WHERE username = ?`;
    await db.run(sql, [
      updatedProduct.product_name,
      updatedProduct.price,
      updatedProduct.number,
      updatedProduct.delivery,
      username,
    ]);

    res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/products',async (req,res)=>{
  const sql = `select * from products;`
  const dbUser=await db.all(sql)
  res.json(dbUser)
})
app.get('/farmers',async (req,res)=>{
  const sql = `select * from farmers;`
  const dbUser=await db.all(sql)
  res.json(dbUser)
})


app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
