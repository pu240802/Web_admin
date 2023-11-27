const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const { getAuth, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth");
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytesResumable, getDownloadURL } = require("firebase/storage");
const app = express();
app.use(fileUpload());

const firebaseConfig = {
    apiKey: "AIzaSyAnw1IHwReqozKELHh4wUylEb_J-d0LZsI",
    authDomain: "shopbag-7720d.firebaseapp.com",
    projectId: "shopbag-7720d",
    storageBucket: "shopbag-7720d.appspot.com",
    messagingSenderId: "216563461281",
    appId: "1:216563461281:web:510bceadc2d7e500b114e0",
    measurementId: "G-GH5ZMB7NVV"
};

// Initialize Firebase client
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp); // Sử dụng Firestore (cơ sở dữ liệu NoSQL của Firebase)
// Create a root reference
const storage = getStorage(firebaseApp);
// Tạo một collection 'products' và thêm một tài liệu (document) vào đó
const productsRef = collection(db, 'products'); // Tạo collection 'products'
const ordersRef = collection(db, 'order'); // Tạo collection 'orders'
const usersRef = collection(db, 'users'); // Tạo collection 'users'

// Sử dụng EJS làm view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use('/styles', express.static(__dirname + '/styles'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const getCurrentUser = () => {
    const currentUser = getAuth(firebaseApp).currentUser;
    return currentUser || null;
}
// Trong mã của bạn, sau khi đã khởi tạo Firebase
const authenticateUser = async (req, res, next) => {
    if (getCurrentUser()) {
        return next();
    }
    return res.redirect('/login')
};

// Route đăng nhập
app.get('/login', async (req, res) => {
    if (getCurrentUser()) {
        res.redirect('/')
    }
    res.render('login', { error: '', email: 'nguyenthinhatphuong02@gmail.com' });
});
app.get('/signup', async (req, res) => {
    res.render('signup', { error: '', email: '', displayName: '' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Signed up 
        const user = userCredential.user;
        res.redirect('/')
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        res.render('login', { error: 'Đăng nhập không thành công', email });
    }
});
// Route đăng ký
app.post('/signup', async (req, res) => {
    const { email, password, displayName } = req.body;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        res.redirect('/');
    } catch (error) {
        console.error('Lỗi khi đăng ký:', error);
        res.render('signup', { error: 'Đăng ký không thành công', email, displayName });
    }
});

/* Phần admin */
// Sử dụng middleware này trước tất cả các route mà bạn muốn bảo vệ
app.use(authenticateUser);
// Thiết lập route cho trang chủ
app.get('/', async (req, res) => {
    try {
        const snapshotProduct = await getDocs(productsRef);
        const snapshotOrder = await getDocs(ordersRef);
        const products = [], orders = [];
        snapshotProduct.forEach((doc) => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });
        snapshotOrder.forEach((doc) => {
            orders.push({
                ...doc.data(),
                id: doc.id,
            });
        });
        res.render('index', { products, orders });
    } catch (error) {
        console.error('Lỗi khi truy xuất dữ liệu từ Firebase:', error);
        res.status(500).send('Lỗi khi truy xuất dữ liệu từ Firebase');
    }
});
// Endpoint để tạo sản phẩm mới (Create)
app.post('/products', async (req, res) => {
    const { title, price, description, stock_quantity } = req.body;

    const currentUser = getCurrentUser();
    const userProfile = await getUserById(currentUser.uid);
    let productData = {
        title,
        price,
        description,
        user_id: currentUser.uid,
        user_name: userProfile ? (userProfile.lastName + " " + userProfile.firstName) : '',
        product_id: "",
        stock_quantity: stock_quantity ? parseInt(stock_quantity) : 0,
    };
    if (req.files) {
        const file = req.files.file;
        //const firebaseFilePath = `images/${time + file.filename}`;
        const storageRef = ref(storage, `images/${file.name}`);

        const metadata = {
            contentType: file.mimetype,
        };
        const snapshot = await uploadBytesResumable(
            storageRef,
            file.data,
            metadata
        );
        // Grab the public url
        const downloadURL = await getDownloadURL(snapshot.ref);
        productData = {
            image: downloadURL, ...productData
        };
    }
    addDoc(productsRef, productData)
        .then((docRef) => {
            // res.send(`Sản phẩm đã được thêm với ID: ${docRef.id}`);
            // Chuyển hướng về trang chủ sau khi xóa thành công
            res.redirect('/');
        })
        .catch((error) => {
            // res.status(500).send('Lỗi khi thêm sản phẩm: ' + error);
            res.redirect('/');
        });
});

// Route để lấy thông tin chi tiết người dùng
app.get('/users/:id', async (req, res) => {
    const userId = req.params.id;
    return getUserById(userId);
});
// Hàm lấy thông tin chi tiết người dùng hiện tại
const getUserById = async (userId) => {
    try {
        const userDoc = await getDoc(doc(usersRef, userId));
        const user = userDoc.data();

        return user;
    } catch (error) {
        console.error('Lỗi khi lấy thông tin chi tiết nguời dùng:', error);
        return false
    }
}
// Endpoint để lấy tất cả đơn hàng (Read)
app.get('/orders', (req, res) => {
    getDocs(ordersRef)
        .then((snapshot) => {
            const orders = [];
            snapshot.forEach((doc) => {
                orders.push({
                    id: doc.id,
                    data: doc.data()
                });
            });
            res.json(orders);
        })
        .catch((error) => {
            res.status(500).send('Lỗi khi lấy thông tin đơn hàng: ' + error);
        });
});
// Route để lấy thông tin chi tiết đơn hàng
app.get('/orders/:id', async (req, res) => {
    const orderId = req.params.id;

    try {
        const orderDoc = await getDoc(doc(ordersRef, orderId));
        const order = orderDoc.data();
        // lấy người dữ liệu khách hàng
        const user = await getUserById(order.user_id);
        res.json({ order, user });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin chi tiết đơn hàng:', error);
        res.status(500).send('Lỗi khi lấy thông tin chi tiết đơn hàng');
    }
});
// Route để lấy thông tin chi tiết sản phẩm
app.get('/products/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const productDoc = await getDoc(doc(productsRef, productId));
        const product = productDoc.data();

        res.json(product);
    } catch (error) {
        console.error('Lỗi khi lấy thông tin chi tiết sản phẩm:', error);
        res.status(500).send('Lỗi khi lấy thông tin chi tiết sản phẩm');
    }
});
// Endpoint để lấy tất cả sản phẩm (Read)
app.get('/products', (req, res) => {
    getDocs(productsRef)
        .then((snapshot) => {
            const products = [];
            snapshot.forEach((doc) => {
                products.push({
                    id: doc.id,
                    data: doc.data()
                });
            });
            res.json(products);
        })
        .catch((error) => {
            res.status(500).send('Lỗi khi lấy thông tin sản phẩm: ' + error);
        });
});

// Endpoint để cập nhật thông tin sản phẩm (Update)
app.post('/products/update/:productId', async (req, res) => {
    const productId = req.params.productId;
    const { title, price, description, stock_quantity } = req.body;
    const currentUser = getCurrentUser();
    const userProfile = await getUserById(currentUser.uid);
    let productData = {
        title,
        price,
        description,
        user_id: currentUser.uid,
        user_name: userProfile ? (userProfile.lastName + " " + userProfile.firstName) : '',
        product_id: "",
        stock_quantity: stock_quantity ? parseInt(stock_quantity) : 0,
    };
    if (req.files) {
        const file = req.files.file;
        //const firebaseFilePath = `images/${time + file.filename}`;
        const storageRef = ref(storage, `images/${file.name}`);

        const metadata = {
            contentType: file.mimetype,
        };
        const snapshot = await uploadBytesResumable(
            storageRef,
            file.data,
            metadata
        );
        // Grab the public url
        const downloadURL = await getDownloadURL(snapshot.ref);
        productData = {
            image: downloadURL, ...productData
        };
    }
    updateDoc(doc(productsRef, productId), productData)
        .then(() => {
            // res.send('Sản phẩm đã được cập nhật trong Firebase Database');
            res.redirect('/');
        })
        .catch((error) => {
            res.status(500).send('Lỗi khi cập nhật sản phẩm: ' + error);
        });
});

// Endpoint để xóa sản phẩm (Delete)
app.post('/products/delete/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        // Thực hiện xóa sản phẩm từ cơ sở dữ liệu Firebase
        await deleteDoc(doc(productsRef, productId));

        // Chuyển hướng về trang chủ sau khi xóa thành công
        res.redirect('/');
    } catch (error) {
        console.error('Lỗi khi xóa sản phẩm:', error);
        res.status(500).send('Lỗi khi xóa sản phẩm');
    }
});
app.get('/logout', async (req, res) => {
    try {
        const logout = await signOut(auth);
        console.log({ logout })
        res.redirect('/login');
    } catch (error) {
        console.error('Lỗi khi đăng xuất:', error);
        res.status(500).send('Lỗi khi đăng xuất');
    }
});
// Chạy server trên cổng 3000
const port = 3000;
app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
});
