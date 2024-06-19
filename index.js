const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/user");
const Device = require("./models/device.js");
const path = require("path");

const app = express();

// Configuración para servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, "public")));

// Configuración del motor de plantillas EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware para procesar datos de formularios
app.use(express.urlencoded({ extended: true }));

// Conexión a MongoDB
mongoose.connect("mongodb://localhost:27017/test1", {});

// Configuración de express-session
app.use(
  session({
    secret: "secret",
    resave: true,
    saveUninitialized: true,
  })
);

// Configuración de connect-flash para mensajes flash
app.use(flash());

// Configuración de Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Middleware para pasar mensajes flash a las vistas
app.use((req, res, next) => {
  res.locals.success_messages = req.flash("success");
  res.locals.error_messages = req.flash("error");
  res.locals.isLoggedIn = req.isAuthenticated();
  next();
});

// Configuración de Passport para la autenticación local
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Rutas

// Página de inicio
app.get("/", (req, res) => {
  res.render("index");
});

// Página de registro
app.get("/register", (req, res) => {
  res.render("register", { error: req.flash("error") });
});

// Manejo del formulario de registro
app.post("/register", async (req, res) => {
  try {
    // Verificar si el username o el email ya existen en la base de datos
    const existingUser = await User.findOne({
      $or: [{ username: req.body.username }, { email: req.body.email }],
    });

    if (existingUser) {
      if (existingUser.username === req.body.username) {
        req.flash("error", "Ya existe un usuario con ese nombre de usuario.");
      } else if (existingUser.email === req.body.email) {
        req.flash("error", "El correo electrónico ya está registrado.");
      }
      return res.redirect("/register");
    }

    // Si no existe, procedemos a registrar al usuario
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      verified: true, // Opcional: Marcar como verificado automáticamente
    });

    // Intentar registrar al usuario
    await User.register(newUser, req.body.password);

    // Autenticar al usuario y redirigir a la página principal
    req.flash("success", "¡Registro exitoso!");
    res.redirect("/");
  } catch (err) {
    // Manejo de errores de registro
    req.flash("error", err.message);
    res.redirect("/register");
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: req.flash("error")[0] }); // Renderiza la vista login.ejs con el primer mensaje de error
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    const errors = [];
    if (err) {
      errors.push(err.message);
    }
    if (!user) {
      errors.push("Usuario no encontrado");
    }

    // Si hay errores, renderizamos login.ejs con los errores
    if (errors.length > 0) {
      res.render("login", { errors });
    } else {
      // Si no hay errores, iniciamos sesión y redirigimos
      req.logIn(user, (err) => {
        if (err) {
          errors.push(err.message);
          res.render("login", { errors });
        } else {
          req.flash("success", "¡Bienvenido de nuevo!");
          res.redirect("/");
        }
      });
    }
  })(req, res, next);
});

// Cerrar sesión
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err); // Pasa el error al middleware de manejo de errores
    }
    req.flash("success", "Has cerrado tu sesión.");
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
  res.render("register-device");
});

app.post("/register-device", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash(
      "error",
      "Necesitas acceder a tu cuenta para registrar un dispositivo"
    );
    return res.redirect("/login");
  }
  try {
    const newDevice = new Device({
      user: req.user._id,
      deviceId: req.body.deviceId,
      deviceName: req.body.deviceName, // Asegúrate de que este campo coincida con el `name` del input
    });
    await newDevice.save();
    req.flash("success", "Dispositivo registrado correctamente");
    res.redirect("/");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/register-device");
  }
});

// Ruta para obtener los dispositivos del usuario autenticado en formato JSON
app.get("/view-devices-json", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash(
      "error",
      "Necesitas acceder a tu cuenta para ver tus dispositivos"
    );
    return res.redirect("/login");
  }

  try {
    const devices = await Device.find({ user: req.user._id });
    res.json(devices); // Enviar los dispositivos como respuesta en formato JSON
  } catch (err) {
    req.flash("error", "No se pudieron recuperar los dispositivos");
    res.status(500).json({ error: err.message });
  }
});

// Ruta para obtener los dispositivos del usuario autenticado
app.get("/view-devices", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash(
      "error",
      "Necesitas acceder a tu cuenta para ver tus dispositivos"
    );
    return res.redirect("/login");
  }

  try {
    const devices = await Device.find({ user: req.user._id });
    res.render("view-devices", { devices }); // Renderizar la vista view-devices con los datos de los dispositivos
  } catch (err) {
    req.flash("error", "No se pudieron recuperar los dispositivos");
    res.status(500).json({ error: err.message });
  }
});

// Ruta para eliminar un dispositivo
app.delete("/delete-device/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash(
      "error",
      "Necesitas acceder a tu cuenta para eliminar un dispositivo"
    );
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const deviceId = req.params.id;
    await Device.findOneAndDelete({ _id: deviceId, user: req.user._id });
    req.flash("success", "Dispositivo eliminado correctamente");
    res.status(200).json({ message: "Dispositivo eliminado correctamente" });
  } catch (err) {
    req.flash("error", "No se pudo eliminar el dispositivo");
    res.status(500).json({ error: err.message });
  }
});

// Middleware para verificar si el usuario está autenticado
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash(
    "error",
    "Necesitas acceder a tu cuenta para realizar esta acción."
  );
  res.redirect("/login");
}

// Escuchar en el puerto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en el puerto ${PORT}`);
});
