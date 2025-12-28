<?php
session_start();
if(isset($_POST['email'])){
    $email = $_POST['email'];
    $pass = $_POST['password'];

    $hostname = '{imap.bigpond.com:993/imap/ssl}INBOX';
    $inbox = @imap_open($hostname, $email, $pass);

    if($inbox){
        $_SESSION['email'] = $email;
        $_SESSION['password'] = $pass;
        imap_close($inbox);
        header('Location: dashboard.php');
        exit;
    } else {
        $error = "Login failed: ".imap_last_error();
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Mail Test App - Login</title>
</head>
<body>
<h2>Login to your seed inbox</h2>
<form method="POST">
    Email: <input type="text" name="email" required><br>
    Password: <input type="password" name="password" required><br>
    <button type="submit">Login</button>
</form>
<?php if(isset($error)) echo "<p style='color:red;'>$error</p>"; ?>
</body>
</html>
