const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/user.js");
const Device = require("./models/device.js");
const nodemailer = require("nodemailer");

const app = express();

// Configuración para servir archivos estáticos
app.use(express.static("public"));

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/your-database-name", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "secret",
    resave: true,
    saveUninitialized: true,
  })
);
app.use(flash());

// Passport.js
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com",
    pass: "your-email-password",
  },
});

// Rutas
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/public/register.html");
});

app.post("/register", (req, res) => {
  const newUser = new User({
    username: req.body.username,
    email: req.body.email,
  });
  User.register(newUser, req.body.password, (err, user) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/register");
    }
    const mailOptions = {
      from: "your-email@gmail.com",
      to: user.email,
      subject: "Verificación de Correo",
      text: `Por favor, verifique su correo en el siguiente link: http://localhost:3000/verify?email=${user.email}`,
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log("Verificación de correo enviado a: " + info.response);
    });
    passport.authenticate("local")(req, res, () => {
      req.flash(
        "success",
        "Ahora estas registrado/a. Por favor revise su correo para verificar su cuenta."
      );
      res.redirect("/");
    });
  });
});

app.get("/verify", (req, res) => {
  const email = req.query.email;
  User.findOneAndUpdate({ email: email }, { verified: true }, (err, user) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/");
    }
    req.flash("success", "Tu correo ha sido verificado. Ahora puedes acceder.");
    res.redirect("/login");
  });
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/");
    }
    req.flash("success", "Haz cerrado tu cuenta");
    res.redirect("/");
  });
});

app.get("/register-device", (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash(
      "error",
      "Necesitas acceder a tu cuenta para registrar un dispositivo"
    );
    return res.redirect("/login");
  }
  res.sendFile(__dirname + "/public/register-device.html");
});

app.post("/register-device", (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash(
      "error",
      "Necesitas acceder a tu cuenta para registrar un dispositivo"
    );
    return res.redirect("/login");
  }
  const newDevice = new Device({
    user: req.user._id,
    deviceId: req.body.deviceId,
  });
  newDevice.save((err) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/register-device");
    }
    req.flash("success", "Dispositivo registrado correctamente");
    res.redirect("/");
  });
});

// Ruta para obtener los dispositivos del usuario autenticado
app.get("/view-devices", (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash(
      "error",
      "Necesitas acceder a tu cuenta para ver tus dispositivos"
    );
    return res.redirect("/login");
  }

  Device.find({ user: req.user._id }, (err, devices) => {
    if (err) {
      req.flash("error", "No se pudieron recuperar los dispositivos");
      return res.redirect("/");
    }

    res.render("view-devices", { devices: devices });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en el puerto ${PORT}`);
});
