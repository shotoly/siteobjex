<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>&#128222;Contact</title>
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../menustyle.css">
    <link rel="shortcut icon" href="../photo/logo vecteur violet électrique.png" />

</head>
<body>
    <header>
        <a href="../index.html" class="logo-container">
            <img src="../photo/logo vecteur violet électrique.svg" alt="logo" class="logo"/>
        </a>
        <nav>
            <ul class="menu">
                <li><a href="#">Educatif</a>
                    <ul class="submenu">
                        <li><a href="Concevoir.html">Concevoir</a></li>
                        <li><a href="Vérifier.html">Vérifier</a></li>
                    </ul>
                </li>
                <li><a href="Professionnel.html">Professionnel</a></li>
                <li><a href="Contact.html">Contact</a></li>
            </ul>
        </nav>
    </header>
    <div class="contact-form">
        <h2>Contactez-moi</h2>
        <form  method="post">
        <form method="post">
        <label>Votre email</label>
        <input type="email" name="email" required>
        <label>Message</label>
        <textarea name="message" required></textarea>
        <input type="submit">
    </form>
        </form>
        <?php
        if (isset($_POST['message'])) {
            $entete  = 'MIME-Version: 1.0' . "\r\n";
            $entete .= 'Content-type: text/html; charset=utf-8' . "\r\n";
            $entete .= 'From: webmaster@monsite.fr' . "\r\n";
            $entete .= 'Reply-to: ' . $_POST['email'];
    
            $message = '<h1>Message envoyé depuis la page Contact de monsite.fr</h1>
            <p><b>Email : </b>' . $_POST['email'] . '<br>
            <b>Message : </b>' . htmlspecialchars($_POST['message']) . '</p>';
    
            $retour = mail('objex3d@gmail.com', 'Envoi depuis page Contact', $message, $entete);
            if($retour)
                echo '<p>Votre message a bien été envoyé.</p>';
        }
        ?>
    </div>
    <footer>
        <p>&copy; 2024 Les pages de Robin. Tous droits réservés.</p>
        <ul class="footer-links">
            <a href="../index.html" class="logo-container">
                <img src="../photo/logo vecteur violet électrique.svg" alt="logo" class="logo"/>
            </a>
            <a href="https://www.instagram.com/objex.3d?igsh=dXczbXB1MGtrZTJr" class="logo-container">
                <img src="../photo/instagram.png" alt="insta" class="instagram"/>
            </a>
        </ul>
    </footer>
</body>