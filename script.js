const API_BASE_URL = "https://pfos-backend.onrender.com";

// Utility function to fetch with retry on 429 errors
async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const waitTime = backoff * Math.pow(2, i);
        console.warn(
          `Rate limit hit (429). Retrying after ${waitTime}ms... (${
            i + 1
          }/${retries})`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }
      return res;
    } catch (error) {
      if (i === retries - 1) throw error;
      const waitTime = backoff * Math.pow(2, i);
      console.warn(
        `Request failed: ${error.message}. Retrying after ${waitTime}ms... (${
          i + 1
        }/${retries})`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Max retries reached for fetch request");
}

// Function to copy order number to clipboard
function copyOrderNumber(btn) {
  const orderNumber = btn.dataset.orderNumber;
  navigator.clipboard
    .writeText(orderNumber)
    .then(() => {
      btn.textContent = "Copied!";
      btn.classList.remove("bg-gray-200", "hover:bg-gray-300");
      btn.classList.add("bg-green-500", "text-white");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("bg-green-500", "text-white");
        btn.classList.add("bg-gray-200", "hover:bg-gray-300");
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy order number:", err);
      btn.textContent = "Error";
      btn.classList.remove("bg-gray-200", "hover:bg-gray-300");
      btn.classList.add("bg-red-500", "text-white");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("bg-red-500", "text-white");
        btn.classList.add("bg-gray-200", "hover:bg-gray-300");
      }, 2000);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("adminToken");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      window.location.href = "/login.html";
    });
  }

  loadAdminDetails();

  const currentPage = window.location.pathname
    .replace(/^\/|\/$/g, "")
    .toLowerCase();
  console.log("Current page:", currentPage);

  if (currentPage === "index.html") {
    loadOverviewStats();
    setupOrderModals();
  } else if (
    currentPage === "products" ||
    currentPage === "products/index.html"
  ) {
    loadProducts();
    setupProductModals();
    setupSearch();
  } else if (currentPage === "orders" || currentPage === "orders/index.html") {
    loadOrders();
    setupOrderModals();
    setupOrderSearch();
  } else if (
    currentPage === "settings" ||
    currentPage === "settings/index.html"
  ) {
    setupSettings();
  }
});

async function loadAdminDetails() {
  const adminNameEl = document.getElementById("admin-name");
  if (!adminNameEl) {
    console.log("🟡 admin-name element not found");
    return;
  }

  try {
    console.log("📤 Fetching admin profile...");
    const res = await fetchWithRetry(`${API_BASE_URL}/api/admin/profile`, {
      headers: authHeaders(),
    });
    console.log("📥 Response status:", res.status);
    const data = await res.json();
    console.log("📊 Admin Profile Data:", data);
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("adminToken");
        window.location.href = "/login.html";
        return;
      }
      throw new Error(data.error || "Failed to load admin details");
    }

    adminNameEl.textContent = `Welcome, ${data.email}`;
  } catch (error) {
    console.error("❌ Error loading admin details:", error.message);
    adminNameEl.textContent = "Welcome, Admin";
  }
}

// Overview Page Functions
async function loadOverviewStats() {
  const loading = document.getElementById("loading");
  const statsError = document.getElementById("stats-error");
  const totalOrdersEl = document.getElementById("total-orders");
  const pendingOrdersEl = document.getElementById("pending-orders");
  const shippedOrdersEl = document.getElementById("shipped-orders");
  const canceledOrdersEl = document.getElementById("canceled-orders");
  const totalProductsEl = document.getElementById("total-products");
  const totalRevenueEl = document.getElementById("total-revenue");
  const recentOrdersEl = document.getElementById("recent-orders");

  if (
    !loading ||
    !statsError ||
    !totalOrdersEl ||
    !pendingOrdersEl ||
    !shippedOrdersEl ||
    !canceledOrdersEl ||
    !totalProductsEl ||
    !totalRevenueEl ||
    !recentOrdersEl
  ) {
    console.error(
      "Required elements for loadOverviewStats are missing on this page."
    );
    return;
  }

  loading.classList.remove("hidden");
  statsError.classList.add("hidden");
  recentOrdersEl.classList.add("hidden");

  try {
    console.log("📤 Fetching stats from:", `${API_BASE_URL}/api/admin/stats`);
    const statsRes = await fetchWithRetry(`${API_BASE_URL}/api/admin/stats`, {
      headers: authHeaders(),
    });
    const statsData = await statsRes.json();
    console.log("📥 Stats Response Status:", statsRes.status);
    console.log("📊 Raw Stats Data:", statsData);

    if (!statsRes.ok) {
      if (statsRes.status === 401) {
        console.warn("🔒 401 Unauthorized - Redirecting to login");
        localStorage.removeItem("adminToken");
        window.location.href = "/auth.html";
        return;
      }
      throw new Error(statsData.error || "Failed to load stats");
    }

    console.log(
      "📤 Fetching orders from:",
      `${API_BASE_URL}/api/orders?page=1`
    );
    const ordersRes = await fetchWithRetry(
      `${API_BASE_URL}/api/orders?page=1`,
      {
        headers: authHeaders(),
      }
    );
    const ordersData = await ordersRes.json();
    console.log("📥 Orders Response Status:", ordersRes.status);
    console.log("📦 Raw Orders Data:", ordersData);

    if (!ordersRes.ok) {
      if (ordersRes.status === 401) {
        console.warn("🔒 401 Unauthorized - Redirecting to login");
        localStorage.removeItem("adminToken");
        window.location.href = "/auth.html";
        return;
      }
      throw new Error(ordersData.error || "Failed to load orders");
    }

    // Update stats
    console.log("🖌️ Updating stats...");
    totalOrdersEl.textContent = (statsData.totalOrders ?? 0).toLocaleString();
    pendingOrdersEl.textContent = (
      statsData.pendingOrders ?? 0
    ).toLocaleString();
    shippedOrdersEl.textContent = (
      statsData.shippedOrders ?? 0
    ).toLocaleString();
    canceledOrdersEl.textContent = (
      statsData.canceledOrders ?? 0
    ).toLocaleString();
    totalProductsEl.textContent = (
      statsData.totalProducts ?? 0
    ).toLocaleString();
    totalRevenueEl.textContent = `₦${(
      statsData.totalRevenue ?? 0
    ).toLocaleString()}`;

    // Order Status Chart
    const orderStatusChartCanvas = document.getElementById("orderStatusChart");
    if (orderStatusChartCanvas) {
      console.log("📈 Rendering Order Status Chart with data:", {
        pending: statsData.pendingOrders,
        shipped: statsData.shippedOrders,
        canceled: statsData.canceledOrders,
      });
      const ctx = orderStatusChartCanvas.getContext("2d");
      new Chart(ctx, {
        type: "pie",
        data: {
          labels: ["Pending", "Shipped", "Canceled"],
          datasets: [
            {
              data: [
                statsData.pendingOrders ?? 0,
                statsData.shippedOrders ?? 0,
                statsData.canceledOrders ?? 0,
              ],
              backgroundColor: [
                "rgba(255, 206, 86, 0.6)",
                "rgba(75, 192, 192, 0.6)",
                "rgba(255, 99, 132, 0.6)",
              ],
              borderColor: [
                "rgba(255, 206, 86, 1)",
                "rgba(75, 192, 192, 1)",
                "rgba(255, 99, 132, 1)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "top" },
            title: { display: true, text: "Order Status Distribution" },
          },
        },
      });
    } else {
      console.error("Order Status Chart canvas not found.");
    }

    // Revenue Over Time Chart
    const revenueOverTimeChartCanvas = document.getElementById(
      "revenueOverTimeChart"
    );
    if (revenueOverTimeChartCanvas) {
      const ctx = revenueOverTimeChartCanvas.getContext("2d");
      const today = new Date();
      const dates = [];
      const revenueData = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split("T")[0];
        dates.push(dateString);
        const revenueEntry = (statsData.revenueOverTime || []).find(
          (entry) => entry._id === dateString
        );
        revenueData.push(revenueEntry ? revenueEntry.totalRevenue : 0);
      }
      console.log("📈 Rendering Revenue Chart with data:", {
        dates,
        revenueData,
      });

      new Chart(ctx, {
        type: "line",
        data: {
          labels: dates,
          datasets: [
            {
              label: "Revenue (₦)",
              data: revenueData,
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            x: {
              title: { display: true, text: "Date" },
              ticks: { maxTicksLimit: 10 },
            },
            y: {
              title: { display: true, text: "Revenue (₦)" },
              beginAtZero: true,
            },
          },
          plugins: {
            legend: { position: "top" },
            title: { display: true, text: "Revenue Over Time (Last 30 Days)" },
          },
        },
      });
    } else {
      console.error("Revenue Over Time Chart canvas not found.");
    }

    // Orders Per Product Chart
    const ordersPerProductChartCanvas = document.getElementById(
      "ordersPerProductChart"
    );
    if (ordersPerProductChartCanvas) {
      const ctx = ordersPerProductChartCanvas.getContext("2d");
      const productNames = (statsData.ordersPerProduct || []).map(
        (entry) => entry._id
      );
      const orderCounts = (statsData.ordersPerProduct || []).map(
        (entry) => entry.orderCount
      );
      console.log("📈 Rendering Orders Per Product Chart with data:", {
        productNames,
        orderCounts,
      });

      new Chart(ctx, {
        type: "bar",
        data: {
          labels: productNames,
          datasets: [
            {
              label: "Number of Orders",
              data: orderCounts,
              backgroundColor: "rgba(54, 162, 235, 0.6)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            x: { title: { display: true, text: "Product" } },
            y: {
              title: { display: true, text: "Number of Orders" },
              beginAtZero: true,
              ticks: { stepSize: 1 },
            },
          },
          plugins: {
            legend: { position: "top" },
            title: { display: true, text: "Orders Per Product" },
          },
        },
      });
    } else {
      console.error("Orders Per Product Chart canvas not found.");
    }

    // Recent Orders
    recentOrdersEl.innerHTML = "";
    if (!ordersData.orders || ordersData.orders.length === 0) {
      console.log("🟡 No orders returned from /api/orders?page=1");
      recentOrdersEl.innerHTML =
        "<p class='text-gray-500 text-center'>No recent orders.</p>";
    } else {
      console.log("🖌️ Rendering recent orders:", ordersData.orders);
      const recentOrders = ordersData.orders.slice(0, 5);
      recentOrders.forEach((order) => {
        const div = document.createElement("div");
        div.className =
          "flex justify-between items-center border-b py-3 px-4 hover:bg-gray-50 transition rounded-lg";
        div.innerHTML = `
          <div class="flex items-center space-x-2">
            <p class="text-gray-800 font-medium">Order #${order.orderNumber}</p>
            <button class="copy-order-number-btn bg-gray-200 text-gray-800 px-2 py-1 rounded hover:bg-gray-300 transition text-sm" data-order-number="${
              order.orderNumber
            }">
              Copy
            </button>
          </div>
          <div class="text-right">
            <p class="text-gray-800 font-medium">₦${(
              order.totalPrice ?? 0
            ).toLocaleString()}</p>
            <p class="text-sm ${
              order.orderStatus === "shipped"
                ? "text-green-500"
                : order.orderStatus === "canceled"
                ? "text-red-500"
                : "text-yellow-500"
            }">${
          order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)
        }</p>
          </div>
          <div>
            <button class="view-order-btn bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition" data-id="${
              order._id
            }">View Details</button>
          </div>
        `;
        recentOrdersEl.appendChild(div);
      });

      document.querySelectorAll(".view-order-btn").forEach((btn) => {
        btn.addEventListener("click", () => viewOrderDetails(btn.dataset.id));
      });

      document.querySelectorAll(".copy-order-number-btn").forEach((btn) => {
        btn.addEventListener("click", () => copyOrderNumber(btn));
      });
    }
    recentOrdersEl.classList.remove("hidden");
  } catch (error) {
    console.error("❌ Error loading overview stats:", error);
    statsError.textContent = error.message;
    statsError.classList.remove("hidden");
    recentOrdersEl.innerHTML =
      "<p class='text-gray-500 text-center'>No recent orders.</p>";
    recentOrdersEl.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
  }
}

// Products Page Functions
async function loadProducts(filter = "") {
  const loading = document.getElementById("loading");
  const productsList = document.getElementById("products-list");
  const noProducts = document.getElementById("no-products");

  if (!loading || !productsList || !noProducts) {
    console.error(
      "Required elements for loadProducts are missing on this page."
    );
    return;
  }

  loading.classList.remove("hidden");
  productsList.classList.add("hidden");
  noProducts.classList.add("hidden");

  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/admin/products`, {
      headers: authHeaders(),
    });
    const products = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("adminToken");
        window.location.href = "/login.html";
        return;
      }
      throw new Error(products.error || "Failed to load products");
    }

    const filteredProducts = products.filter((p) =>
      p.name.toLowerCase().includes(filter.toLowerCase())
    );

    productsList.innerHTML = "";
    if (filteredProducts.length === 0) {
      noProducts.classList.remove("hidden");
    } else {
      filteredProducts.forEach((product) => {
        const div = document.createElement("div");
        div.className =
          "bg-white p-4 rounded-lg shadow hover:shadow-lg transition";
        div.innerHTML = `
          <img src="${API_BASE_URL}${product.image}" alt="${
          product.name
        }" class="w-full h-40 object-cover rounded-md mb-4">
          <h3 class="text-lg font-medium text-gray-800">${product.name}</h3>
          <p class="text-gray-600">₦${product.price.toLocaleString()}</p>
          <p class="text-sm text-gray-500 line-clamp-2">${
            product.description
          }</p>
          <div class="mt-3 flex space-x-2">
            <button class="edit-btn bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600" data-id="${
              product._id
            }">Edit</button>
            <button class="delete-btn bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600" data-id="${
              product._id
            }">Delete</button>
          </div>
        `;
        productsList.appendChild(div);
      });

      document.querySelectorAll(".edit-btn").forEach((btn) => {
        btn.addEventListener("click", () => editProduct(btn.dataset.id));
      });
      document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", () => deleteProduct(btn.dataset.id));
      });
    }
  } catch (error) {
    console.error("Error loading products:", error);
    productsList.innerHTML =
      "<p class='text-red-500 text-center'>Failed to load products.</p>";
  } finally {
    loading.classList.add("hidden");
    productsList.classList.remove("hidden");
  }
}

function setupProductModals() {
  const addModal = document.getElementById("add-product-modal");
  const editModal = document.getElementById("edit-product-modal");
  const addBtn = document.getElementById("add-product-btn");
  const addImageFile = document.getElementById("product-image-file");
  const addImagePreview = document.getElementById("add-image-preview");
  const addImagePlaceholder = document.getElementById("add-image-placeholder");
  const editImageFile = document.getElementById("edit-product-image-file");
  const editImagePreview = document.getElementById("edit-image-preview");

  if (
    !addModal ||
    !editModal ||
    !addBtn ||
    !addImageFile ||
    !addImagePreview ||
    !addImagePlaceholder ||
    !editImageFile ||
    !editImagePreview
  ) {
    console.error(
      "Required elements for setupProductModals are missing on this page."
    );
    return;
  }

  addBtn.addEventListener("click", () => {
    addModal.classList.remove("hidden");
    setTimeout(
      () => addModal.querySelector("div").classList.remove("scale-95"),
      10
    );
    addImagePreview.classList.add("hidden");
    addImagePlaceholder.classList.remove("hidden");
  });

  document.getElementById("cancel-add-btn").addEventListener("click", () => {
    addModal.querySelector("div").classList.add("scale-95");
    setTimeout(() => addModal.classList.add("hidden"), 300);
    document.getElementById("add-product-form").reset();
    document.getElementById("add-error").classList.add("hidden");
    addImagePreview.classList.add("hidden");
    addImagePlaceholder.classList.remove("hidden");
  });

  document.getElementById("cancel-edit-btn").addEventListener("click", () => {
    editModal.querySelector("div").classList.add("scale-95");
    setTimeout(() => editModal.classList.add("hidden"), 300);
    document.getElementById("edit-error").classList.add("hidden");
  });

  addImageFile.addEventListener("change", () => {
    const file = addImageFile.files[0];
    if (file) {
      console.log("Selected file:", file);
      if (!file.type.match("image/jpeg") && !file.type.match("image/png")) {
        document.getElementById("add-error").textContent =
          "Only JPEG or PNG images are allowed.";
        document.getElementById("add-error").classList.remove("hidden");
        addImageFile.value = "";
        addImagePreview.classList.add("hidden");
        addImagePlaceholder.classList.remove("hidden");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        document.getElementById("add-error").textContent =
          "Image size must be less than 5MB.";
        document.getElementById("add-error").classList.remove("hidden");
        addImageFile.value = "";
        addImagePreview.classList.add("hidden");
        addImagePlaceholder.classList.remove("hidden");
        return;
      }
      addImagePreview.src = URL.createObjectURL(file);
      addImagePreview.classList.remove("hidden");
      addImagePlaceholder.classList.add("hidden");
      addModal.querySelector("div").scrollTo({
        top: addModal.querySelector("div").scrollHeight,
        behavior: "smooth",
      });
    } else {
      addImagePreview.classList.add("hidden");
      addImagePlaceholder.classList.remove("hidden");
    }
  });

  editImageFile.addEventListener("change", () => {
    const file = editImageFile.files[0];
    if (file) {
      console.log("Selected file for edit:", file);
      if (!file.type.match("image/jpeg") && !file.type.match("image/png")) {
        document.getElementById("edit-error").textContent =
          "Only JPEG or PNG images are allowed.";
        document.getElementById("edit-error").classList.remove("hidden");
        editImageFile.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        document.getElementById("edit-error").textContent =
          "Image size must be less than 5MB.";
        document.getElementById("edit-error").classList.remove("hidden");
        editImageFile.value = "";
        return;
      }
      editImagePreview.src = URL.createObjectURL(file);
      editModal.querySelector("div").scrollTo({
        top: editModal.querySelector("div").scrollHeight,
        behavior: "smooth",
      });
    }
  });

  document
    .getElementById("add-product-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("add-submit-btn");
      const loadingIcon = document.getElementById("add-loading");
      const errorDiv = document.getElementById("add-error");
      const price = parseFloat(document.getElementById("product-price").value);

      if (price <= 0 || price > 1000000) {
        errorDiv.textContent = "Price must be between 0 and 1,000,000.";
        errorDiv.classList.remove("hidden");
        return;
      }

      submitBtn.disabled = true;
      loadingIcon.classList.remove("hidden");
      errorDiv.classList.add("hidden");

      const formData = new FormData();
      formData.append(
        "name",
        document.getElementById("product-name").value.trim()
      );
      formData.append("price", price);
      formData.append(
        "description",
        document.getElementById("product-description").value.trim()
      );
      formData.append("image", addImageFile.files[0]);

      try {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/admin/products`, {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("adminToken");
            window.location.href = "/login.html";
            return;
          }
          throw new Error(data.error || "Failed to add product");
        }
        loadProducts();
        addModal.querySelector("div").classList.add("scale-95");
        setTimeout(() => addModal.classList.add("hidden"), 300);
        e.target.reset();
        addImagePreview.classList.add("hidden");
        addImagePlaceholder.classList.remove("hidden");
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.remove("hidden");
      } finally {
        submitBtn.disabled = false;
        loadingIcon.classList.add("hidden");
      }
    });

  document
    .getElementById("edit-product-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("edit-submit-btn");
      const loadingIcon = document.getElementById("edit-loading");
      const errorDiv = document.getElementById("edit-error");
      const price = parseFloat(
        document.getElementById("edit-product-price").value
      );

      if (price <= 0 || price > 1000000) {
        errorDiv.textContent = "Price must be between 0 and 1,000,000.";
        errorDiv.classList.remove("hidden");
        return;
      }

      submitBtn.disabled = true;
      loadingIcon.classList.remove("hidden");
      errorDiv.classList.add("hidden");

      const formData = new FormData();
      formData.append(
        "name",
        document.getElementById("edit-product-name").value.trim()
      );
      formData.append("price", price);
      formData.append(
        "description",
        document.getElementById("edit-product-description").value.trim()
      );
      if (editImageFile.files[0])
        formData.append("image", editImageFile.files[0]);

      const id = document.getElementById("edit-product-id").value;

      try {
        const res = await fetchWithRetry(
          `${API_BASE_URL}/api/admin/products/${id}`,
          {
            method: "PUT",
            headers: authHeaders(),
            body: formData,
          }
        );
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("adminToken");
            window.location.href = "/login.html";
            return;
          }
          throw new Error(data.error || "Failed to update product");
        }
        loadProducts();
        editModal.querySelector("div").classList.add("scale-95");
        setTimeout(() => editModal.classList.add("hidden"), 300);
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.remove("hidden");
      } finally {
        submitBtn.disabled = false;
        loadingIcon.classList.add("hidden");
      }
    });
}

function setupSearch() {
  const searchInput = document.getElementById("product-search");
  if (!searchInput) {
    console.error("Required element for setupSearch is missing on this page.");
    return;
  }
  searchInput.addEventListener("input", (e) => {
    loadProducts(e.target.value);
  });
}

async function editProduct(id) {
  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/admin/products`, {
      headers: authHeaders(),
    });
    const products = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("adminToken");
        window.location.href = "/login.html";
        return;
      }
      throw new Error(products.error || "Failed to load products");
    }

    const product = products.find((p) => p._id === id);
    if (product) {
      document.getElementById("edit-product-id").value = product._id;
      document.getElementById("edit-product-name").value = product.name;
      document.getElementById("edit-product-price").value = product.price;
      document.getElementById("edit-product-description").value =
        product.description;
      document.getElementById(
        "edit-image-preview"
      ).src = `${API_BASE_URL}${product.image}`;
      const editModal = document.getElementById("edit-product-modal");
      editModal.classList.remove("hidden");
      setTimeout(
        () => editModal.querySelector("div").classList.remove("scale-95"),
        10
      );
    }
  } catch (error) {
    console.error("Error loading product for edit:", error);
    alert("Failed to load product details.");
  }
}

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  try {
    const res = await fetchWithRetry(
      `${API_BASE_URL}/api/admin/products/${id}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("adminToken");
        window.location.href = "/login.html";
        return;
      }
      throw new Error(data.error || "Failed to delete product");
    }
    loadProducts();
  } catch (error) {
    console.error("Error deleting product:", error);
    alert(error.message);
  }
}

// Orders Page Functions
let currentPage = 1;
let totalPages = 1;

async function loadOrders(filter = "", page = 1) {
  const loading = document.getElementById("loading");
  const ordersList = document.getElementById("orders-list");
  const noOrders = document.getElementById("no-orders");
  const pagination = document.getElementById("pagination");
  const prevPageBtn = document.getElementById("prev-page");
  const nextPageBtn = document.getElementById("next-page");
  const pageInfo = document.getElementById("page-info");

  if (
    !loading ||
    !ordersList ||
    !noOrders ||
    !pagination ||
    !prevPageBtn ||
    !nextPageBtn ||
    !pageInfo
  ) {
    console.error("Required elements for loadOrders are missing on this page.");
    return;
  }

  loading.classList.remove("hidden");
  ordersList.classList.add("hidden");
  noOrders.classList.add("hidden");
  pagination.classList.add("hidden");

  try {
    const res = await fetchWithRetry(
      `${API_BASE_URL}/api/orders?page=${page}`,
      {
        headers: authHeaders(),
      }
    );
    const data = await res.json();
    console.log("Orders API response:", data);
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("adminToken");
        window.location.href = "/login.html";
        return;
      }
      throw new Error(data.error || "Failed to load orders");
    }

    const { orders, totalPages: total, currentPage: current } = data;
    currentPage = current;
    totalPages = total;

    const filteredOrders = orders.filter(
      (o) =>
        o.name.toLowerCase().includes(filter.toLowerCase()) ||
        o.email.toLowerCase().includes(filter.toLowerCase()) ||
        o.orderNumber.toLowerCase().includes(filter.toLowerCase())
    );

    ordersList.innerHTML = "";
    if (filteredOrders.length === 0) {
      noOrders.classList.remove("hidden");
    } else {
      filteredOrders.forEach((order) => {
        const div = document.createElement("div");
        div.className =
          "bg-white p-4 rounded-lg shadow hover:shadow-lg transition flex justify-between items-center";
        div.innerHTML = `
          <div>
            <div class="flex items-center space-x-2">
              <h3 class="text-lg font-medium text-gray-800">Order #${
                order.orderNumber
              }</h3>
              <button class="copy-order-number-btn bg-gray-200 text-gray-800 px-2 py-1 rounded hover:bg-gray-300 transition text-sm" data-order-number="${
                order.orderNumber
              }">
                Copy
              </button>
            </div>
            <p class="text-gray-600">${order.name}</p>
            <p class="text-gray-600">₦${order.totalPrice.toLocaleString()}</p>
            <p class="text-sm text-gray-500">${new Date(
              order.createdAt
            ).toLocaleDateString()}</p>
            <p class="text-sm font-medium ${
              order.orderStatus === "shipped"
                ? "text-green-500"
                : order.orderStatus === "canceled"
                ? "text-red-500"
                : "text-yellow-500"
            }">${
          order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)
        }</p>
          </div>
          <div>
            <button class="view-order-btn bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition" data-id="${
              order._id
            }">View Details</button>
          </div>
        `;
        ordersList.appendChild(div);
      });

      document.querySelectorAll(".view-order-btn").forEach((btn) => {
        btn.addEventListener("click", () => viewOrderDetails(btn.dataset.id));
      });

      document.querySelectorAll(".copy-order-number-btn").forEach((btn) => {
        btn.addEventListener("click", () => copyOrderNumber(btn));
      });

      if (totalPages > 1) {
        pagination.classList.remove("hidden");
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
      }
    }
  } catch (error) {
    console.error("Error loading orders:", error);
    ordersList.innerHTML =
      "<p class='text-red-500 text-center'>Failed to load orders.</p>";
  } finally {
    loading.classList.add("hidden");
    ordersList.classList.remove("hidden");
  }
}

function setupOrderModals() {
  const orderModal = document.getElementById("order-details-modal");
  const closeOrderBtn = document.getElementById("close-order-btn");
  const updateStatusBtn = document.getElementById("update-status-btn");
  const prevPageBtn = document.getElementById("prev-page");
  const nextPageBtn = document.getElementById("next-page");

  if (!orderModal || !closeOrderBtn || !updateStatusBtn) {
    console.error(
      "Required elements (orderModal, closeOrderBtn, updateStatusBtn) for setupOrderModals are missing on this page."
    );
    return;
  }

  closeOrderBtn.addEventListener("click", () => {
    orderModal.querySelector("div").classList.add("scale-95");
    setTimeout(() => orderModal.classList.add("hidden"), 300);
    document.getElementById("order-error").classList.add("hidden");
  });

  updateStatusBtn.addEventListener("click", async () => {
    const orderId = document.getElementById("order-id-hidden").value;
    const newStatus = document.getElementById("order-status-update").value;
    const updateBtn = document.getElementById("update-status-btn");
    const loadingIcon = document.getElementById("update-loading");
    const errorDiv = document.getElementById("order-error");

    updateBtn.disabled = true;
    loadingIcon.classList.remove("hidden");
    errorDiv.classList.add("hidden");

    try {
      const res = await fetchWithRetry(
        `${API_BASE_URL}/api/orders/${orderId}/status`,
        {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ orderStatus: newStatus }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("adminToken");
          window.location.href = "/login.html";
          return;
        }
        throw new Error(data.error || "Failed to update order status");
      }
      const currentPagePath = window.location.pathname
        .replace(/^\/|\/$/g, "")
        .toLowerCase();
      if (
        currentPagePath === "orders" ||
        currentPagePath === "orders/index.html"
      ) {
        loadOrders("", currentPage);
      } else {
        loadOverviewStats();
      }
      orderModal.querySelector("div").classList.add("scale-95");
      setTimeout(() => orderModal.classList.add("hidden"), 300);
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove("hidden");
    } finally {
      updateBtn.disabled = false;
      loadingIcon.classList.add("hidden");
    }
  });

  if (prevPageBtn && nextPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        loadOrders(
          document.getElementById("order-search").value,
          currentPage - 1
        );
      }
    });

    nextPageBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        loadOrders(
          document.getElementById("order-search").value,
          currentPage + 1
        );
      }
    });
  }
}

async function viewOrderDetails(id) {
  const orderModal = document.getElementById("order-details-modal");
  const errorDiv = document.getElementById("order-error");
  const orderIdEl = document.getElementById("order-id");
  const customerNameEl = document.getElementById("order-customer-name");
  const customerEmailEl = document.getElementById("order-customer-email");
  const customerPhoneEl = document.getElementById("order-customer-phone");
  const customerAddressEl = document.getElementById("order-customer-address");
  const orderDateEl = document.getElementById("order-date");
  const orderTotalEl = document.getElementById("order-total");
  const orderStatusEl = document.getElementById("order-status");
  const orderStatusUpdateEl = document.getElementById("order-status-update");
  const itemsList = document.getElementById("order-items");

  if (
    !orderModal ||
    !errorDiv ||
    !orderIdEl ||
    !customerNameEl ||
    !customerEmailEl ||
    !customerPhoneEl ||
    !customerAddressEl ||
    !orderDateEl ||
    !orderTotalEl ||
    !orderStatusEl ||
    !orderStatusUpdateEl ||
    !itemsList
  ) {
    console.error("Required elements for viewOrderDetails are missing.");
    return;
  }

  errorDiv.classList.add("hidden");
  orderIdEl.textContent = "Loading...";
  customerNameEl.textContent = "Loading...";
  customerEmailEl.textContent = "Loading...";
  customerPhoneEl.textContent = "Loading...";
  customerAddressEl.textContent = "Loading...";
  orderDateEl.textContent = "Loading...";
  orderTotalEl.textContent = "Loading...";
  orderStatusEl.textContent = "Loading...";
  orderStatusUpdateEl.value = "";
  itemsList.innerHTML = "<li>Loading...</li>";

  orderModal.classList.remove("hidden");
  setTimeout(
    () => orderModal.querySelector("div").classList.remove("scale-95"),
    10
  );

  try {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/orders/${id}`, {
      headers: authHeaders(),
    });
    const order = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("adminToken");
        window.location.href = "/login.html";
        return;
      }
      throw new Error(order.error || "Failed to load order details");
    }

    orderIdEl.innerHTML = `
      ${order.orderNumber}
      <button class="copy-order-number-btn bg-gray-200 text-gray-800 px-2 py-1 rounded hover:bg-gray-300 transition text-sm ml-2" data-order-number="${order.orderNumber}">
        Copy
      </button>
    `;
    customerNameEl.textContent = order.name;
    customerEmailEl.textContent = order.email;
    customerPhoneEl.textContent = order.phone;
    customerAddressEl.textContent = order.address;
    orderDateEl.textContent = new Date(order.createdAt).toLocaleDateString();
    orderTotalEl.textContent = (order.totalPrice ?? 0).toLocaleString();
    orderStatusEl.textContent =
      order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1);
    orderStatusUpdateEl.value = order.orderStatus;

    const hiddenIdInput = document.createElement("input");
    hiddenIdInput.type = "hidden";
    hiddenIdInput.id = "order-id-hidden";
    hiddenIdInput.value = order._id;
    orderModal.querySelector("div").appendChild(hiddenIdInput);

    itemsList.innerHTML = "";
    if (order.cart.length === 0) {
      itemsList.innerHTML = "<li>No items in this order.</li>";
    } else {
      order.cart.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = `${item.name} - ₦${(
          item.price ?? 0
        ).toLocaleString()} (Qty: ${item.quantity})`;
        itemsList.appendChild(li);
      });
    }

    orderIdEl
      .querySelector(".copy-order-number-btn")
      .addEventListener("click", () => {
        copyOrderNumber(orderIdEl.querySelector(".copy-order-number-btn"));
      });
  } catch (error) {
    console.error("Error loading order details:", error);
    errorDiv.textContent = error.message;
    errorDiv.classList.remove("hidden");
    orderIdEl.textContent = "N/A";
    customerNameEl.textContent = "N/A";
    customerEmailEl.textContent = "N/A";
    customerPhoneEl.textContent = "N/A";
    customerAddressEl.textContent = "N/A";
    orderDateEl.textContent = "N/A";
    orderTotalEl.textContent = "N/A";
    orderStatusEl.textContent = "N/A";
    orderStatusUpdateEl.value = "";
    itemsList.innerHTML = "<li>Unable to load items.</li>";
  }
}

function setupOrderSearch() {
  const searchInput = document.getElementById("order-search");
  if (!searchInput) {
    console.error(
      "Required element for setupOrderSearch is missing on this page."
    );
    return;
  }
  searchInput.addEventListener("input", (e) => {
    currentPage = 1;
    loadOrders(e.target.value, currentPage);
  });
}

// Settings Page Functions
function setupSettings() {
  const changePasswordForm = document.getElementById("change-password-form");
  const updateEmailForm = document.getElementById("update-email-form");

  if (!changePasswordForm || !updateEmailForm) {
    console.error(
      "Required elements for setupSettings are missing on this page."
    );
    return;
  }

  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const changePasswordBtn = document.getElementById("change-password-btn");
    const loadingIcon = document.getElementById("password-loading");
    const errorDiv = document.getElementById("password-error");

    if (newPassword !== confirmPassword) {
      errorDiv.textContent = "New password and confirm password do not match";
      errorDiv.classList.remove("hidden");
      return;
    }

    if (newPassword.length < 6) {
      errorDiv.textContent = "New password must be at least 6 characters long";
      errorDiv.classList.remove("hidden");
      return;
    }

    changePasswordBtn.disabled = true;
    loadingIcon.classList.remove("hidden");
    errorDiv.classList.add("hidden");

    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/api/admin/password`, {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("adminToken");
          window.location.href = "/login.html";
          return;
        }
        throw new Error(data.error || "Failed to change password");
      }

      alert("Password changed successfully! Please log in again.");
      localStorage.removeItem("adminToken");
      window.location.href = "/login.html";
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove("hidden");
    } finally {
      changePasswordBtn.disabled = false;
      loadingIcon.classList.add("hidden");
    }
  });

  updateEmailForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newEmail = document.getElementById("new-email").value;
    const updateEmailBtn = document.getElementById("update-email-btn");
    const loadingIcon = document.getElementById("email-loading");
    const errorDiv = document.getElementById("email-error");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      errorDiv.textContent = "Invalid email format";
      errorDiv.classList.remove("hidden");
      return;
    }

    updateEmailBtn.disabled = true;
    loadingIcon.classList.remove("hidden");
    errorDiv.classList.add("hidden");

    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/api/admin/email`, {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("adminToken");
          window.location.href = "/login.html";
          return;
        }
        throw new Error(data.error || "Failed to update email");
      }

      alert("Email updated successfully!");
      window.location.reload();
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.classList.remove("hidden");
    } finally {
      updateEmailBtn.disabled = false;
      loadingIcon.classList.add("hidden");
    }
  });
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("adminToken")}` };
}
